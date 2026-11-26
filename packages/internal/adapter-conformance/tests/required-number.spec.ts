import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { naiveUiAdapter } from '@fbkworks/adapter-naive-ui'
import { FbkFormGenerator } from '@fbkworks/components'

/**
 * 必填数字字段的**语义**断言：值 0 / 5 通过，空值不通过。
 *
 * 为什么放在 conformance 而不是 components：
 * components 的测试不许 import 具体适配器（eslint 边界 1 +
 * dependency-cruiser 的 components-must-not-depend-on-adapters），
 * 因此那边只能断言**规则形状**（见 components/tests/form-generator-required-number.spec.ts）。
 * 「0 到底算不算填了」必须真的跑一遍校验才看得见，而跑校验就得有真适配器 ——
 * 这个包里 import 适配器是允许的，所以语义断言落在这里。
 *
 * 为什么只有 naive-ui：
 * element-plus 在 jsdom 下 `ElForm.validate()` **恒定返回 true**，任何断言都会假绿。
 * 根因不是 jsdom，是它自己的三条链路把失败吞掉了（读源码 + 实测）：
 *   1. `ElFormItem.doValidate` 在 `new AsyncValidator(...)` 处就抛错 —— 连合法值 5 也一样，
 *      于是既没走 onValidationSucceeded 也没走 onValidationFailed；
 *   2. `validate()` 的 catch 里 `const { fields } = err` 拿到 undefined，于是 `Promise.reject(undefined)`；
 *   3. `ElForm.doValidateField` 用 `{...validationErrors, ...fields}` 收集，展开 undefined 得空对象
 *      → `Object.keys(...).length === 0` → 返回 true。
 * 实测证据：对 0 / 5 / 空三种取值，校验后 `validateState` 都停在 'validating'（既非 'success'
 * 也非 'error'），且抛出的不是 {errors,fields} 形状 —— 第 1 条由此判定，第 2、3 条与源码一致。
 * 所以 element-plus 这一端**无法**在本环境里断言语义，覆盖它只会引入假绿。
 *
 * 红→绿：把 FormGenerator.vue 里 `...(field.type === 'number' ? { type: 'number' } : {})`
 * 去掉后，async-validator 退回 string 校验，「数值 0 通过」两条会变红；
 * 还原即绿。空值那两条在两种写法下都红（required 本身仍在），
 * 它们守的是「别为了修 0 把 required 一起删掉」。
 */

const schema = {
  fields: [{ name: 'stock', label: '库存', type: 'number' as const, required: true }],
}

async function validateStock(modelValue: Record<string, unknown>) {
  const wrapper = mountWithAdapter(FbkFormGenerator as any, {
    adapter: naiveUiAdapter as any,
    props: { schema, modelValue },
  })
  await flushPromises()
  try {
    await (wrapper.vm as any).validate()
    return { passed: true as const }
  } catch (error) {
    return { passed: false as const, error }
  } finally {
    wrapper.unmount()
  }
}

describe('必填数字字段：值 0 不是「没填」', () => {
  it('数值 0 通过', async () => {
    const { passed } = await validateStock({ stock: 0 })
    expect(passed).toBe(true)
  })

  it('数值 5 通过（与 0 同一路径，防止只特判了 0）', async () => {
    const { passed } = await validateStock({ stock: 5 })
    expect(passed).toBe(true)
  })

  it('undefined 不通过，且报的是 required 的文案', async () => {
    const result = await validateStock({ stock: undefined })
    expect(result.passed).toBe(false)
    /* 归属断言：失败必须来自那条 required 规则，
       而不是「校验器崩了」或「模型没传进去」这类也会 reject 的原因。 */
    expect(JSON.stringify(result.passed === false ? result.error : '')).toContain('库存不能为空')
  })

  it('null 不通过', async () => {
    const { passed } = await validateStock({ stock: null })
    expect(passed).toBe(false)
  })
})
