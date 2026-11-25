import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetWarnCache } from '@fbkworks/shared'
import { mountWithAdapter } from '@fbkworks/test-utils'
import { FbkFormGenerator } from '../src/form-generator'
import { FbkFormModal } from '../src/form-modal'
import { FbkProTable } from '../src/pro-table'

/**
 * 开发期 prop 校验**接到真实组件**之后行为如何。
 *
 * 与 packages/adapter-core/tests/dev-warn.spec.ts 的分工：那边测工具本身（文案、去重、
 * 登记表），这边测「三个调用点真的会说话」。少了这一层，工具函数可以全绿而组件一行都
 * 没接 —— 那正是「声明了但从不读取」的另一面：**提示写了但从来没被调用**。
 *
 * props 上用 `as any` 是有意的：这里模拟的是「业务方按旧版文档写了一个已删字段」，
 * 那种写法在 TS 下本来就报错，而 JS 用户 / 老版本升级上来的代码会一路静默。
 */

const columns = [{ key: 'name', title: '名称', dataIndex: 'name' }]
const rows = [{ id: 1, name: 'Alice' }]

describe('开发期 prop 校验（真实组件）', () => {
  let spy: ReturnType<typeof vi.spyOn>
  const messages = () => spy.mock.calls.map((call) => String(call[0]))

  beforeEach(() => {
    resetWarnCache()
    spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('ProTable：列上写 hideInCard → 指向 mobile.hidden', async () => {
    mountWithAdapter(FbkProTable, {
      props: { columns: [{ ...columns[0], hideInCard: true } as any], data: rows, rowKey: 'id' },
    })
    await flushPromises()

    const hit = messages().find((message) => message.includes('hideInCard'))
    expect(hit).toBeDefined()
    expect(hit).toContain('mobile.hidden')
  })

  it('ProTable：列上写 search → 指向 QueryForm', async () => {
    mountWithAdapter(FbkProTable, {
      props: { columns: [{ ...columns[0], search: true } as any], data: rows, rowKey: 'id' },
    })
    await flushPromises()

    const hit = messages().find((message) => message.includes('search'))
    expect(hit).toBeDefined()
    expect(hit).toContain('QueryForm')
  })

  it('ProTable：顶层传已删的 toolbar → 列出可用字段', async () => {
    mountWithAdapter(FbkProTable, {
      /* 未声明的键由 VTU 落到 attrs —— 这正是「业务方按旧文档写了一个已删 prop」的样子 */
      props: { columns, data: rows, rowKey: 'id', toolbar: false },
    })
    await flushPromises()

    const hit = messages().find((message) => message.includes('toolbar'))
    expect(hit).toBeDefined()
    expect(hit).toContain('可用字段')
  })

  it('FormModal：传已删的 autoFocus → 指向自己聚焦', async () => {
    mountWithAdapter(FbkFormModal, {
      props: {
        schema: { fields: [{ name: 'name', label: '名称', type: 'input' }] },
        submit: async () => true,
        show: true,
        autoFocus: true,
      },
    })
    await flushPromises()

    const hit = messages().find((message) => message.includes('autoFocus'))
    expect(hit).toBeDefined()
    expect(hit).toContain('focus()')
  })

  it('FormGenerator：字段里写已删的 dependencies → 说明本来就会重算', async () => {
    mountWithAdapter(FbkFormGenerator, {
      props: {
        schema: {
          fields: [
            { name: 'name', label: '名称', type: 'input' },
            { name: 'city', label: '城市', type: 'input', dependencies: ['name'] },
          ] as any,
        },
      },
    })
    await flushPromises()

    const hit = messages().find((message) => message.includes('dependencies'))
    expect(hit).toBeDefined()
    expect(hit).toContain('重算')
  })

  it('合法写法不产生噪音（否则开发期控制台会被淹，提示就没人看了）', async () => {
    mountWithAdapter(FbkProTable, {
      props: {
        columns: [{ ...columns[0], tooltip: '说明', mobile: { hidden: false } } as any],
        data: rows,
        rowKey: 'id',
      },
    })
    await flushPromises()

    expect(messages().filter((message) => message.startsWith('[fbk] '))).toEqual([])
  })
})
