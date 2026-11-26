import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { FbkFormGenerator } from '../src/form-generator'

/**
 * 必填数字字段：预填 0 被判成「没填」。
 *
 * 根因在规则形状 —— 字段级 required 展开成 `{ required: true, message }` 时不带 type，
 * async-validator 于是退回 string 校验，数字值（实测 0 和 5 都一样）过不了类型检查，
 * 报出来的却是 required 的 message，于是红字说「库存不能为空」。
 *
 * 这里断言规则本身必须带 type：这是 jsdom 里唯一能戳破它的层面 ——
 * components 的测试不许 import 具体适配器（eslint.config.mjs 边界 1 +
 * dependency-cruiser 的 components-must-not-depend-on-adapters），
 * 而 element-plus 在 jsdom 下 validate() 恒为 true（apps/playground/src/probe.ts 有记录）。
 * 「值 0 通过 / 空值不通过」的端到端证据见 demo
 * packages/internal/demos/src/form-generator/required-number-zero.vue。
 */
const numberField = { name: 'stock', label: '库存', type: 'number' as const, required: true }

function rulesOf(wrapper: any): any[][] {
  return wrapper.findAllComponents({ name: 'MockFormItem' }).map((item: any) => item.props('rules'))
}

async function mountRules(fields: any[]) {
  const wrapper = mountWithAdapter(FbkFormGenerator, { props: { schema: { fields } } })
  await flushPromises()
  return rulesOf(wrapper)
}

describe('FormGenerator required 规则的类型标注', () => {
  it('数字字段的 required 规则带 type: number（否则数字值会被当成空值）', async () => {
    const [rules] = await mountRules([numberField])
    expect(rules[0]).toEqual(expect.objectContaining({ required: true, type: 'number' }))
  })

  it('非数字字段的 required 规则不带 type（一律写 string 会让日期/数组字段反向出错）', async () => {
    const rules = await mountRules([
      { name: 'name', label: '名称', type: 'input', required: true },
      { name: 'birthday', label: '生日', type: 'date', required: true },
    ])
    expect(rules).toHaveLength(2)
    for (const list of rules) {
      expect(list[0]).toEqual(expect.objectContaining({ required: true }))
      expect(list[0]).not.toHaveProperty('type')
    }
  })

  it('数字字段照样是必填：required 与提示文案都不能丢', async () => {
    const [rules] = await mountRules([numberField])
    expect(rules[0]).toEqual(
      expect.objectContaining({ required: true, message: '库存不能为空' }),
    )
  })

  it('数字字段的 type 与 schema 级、字段级 rules 共存，不互相覆盖', async () => {
    const wrapper = mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          rules: { stock: [{ min: 0, message: '不能为负' }] },
          fields: [{ ...numberField, rules: [{ max: 999, message: '太多了' }] }],
        },
      },
    })
    await flushPromises()
    const [rules] = rulesOf(wrapper)
    expect(rules[0]).toEqual(expect.objectContaining({ required: true, type: 'number' }))
    expect(rules.map((rule: any) => rule.message)).toEqual(['库存不能为空', '不能为负', '太多了'])
  })
})
