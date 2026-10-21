import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { FbkDescriptions } from '../src/descriptions'

// Descriptions 不依赖适配器，直接 mount 即可——这是架构上的有意设计。
describe('FbkDescriptions', () => {
  it('不需要 adapter 即可渲染', () => {
    const wrapper = mount(FbkDescriptions, {
      props: {
        data: { name: 'Alice', age: 30 },
        items: [
          { key: 'name', label: '姓名' },
          { key: 'age', label: '年龄', getValue: (row: any) => `${row.age} 岁` },
        ],
      },
    })
    expect(wrapper.text()).toContain('姓名')
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('30 岁')
  })

  it('空值渲染为 -', () => {
    const wrapper = mount(FbkDescriptions, {
      props: { data: {}, items: [{ key: 'name', label: '姓名' }] },
    })
    expect(wrapper.text()).toContain('-')
  })

  it('对象形式的 column 展开成断点变量', () => {
    // 注意：列数变量落在每个分组的 <dl> 上，而不是根元素 ——
    // 因为分组可以各自有不同的列数（group.column 覆盖组件级 column）。
    const wrapper = mount(FbkDescriptions, {
      props: {
        data: { name: 'Alice' },
        items: [{ key: 'name', label: '姓名' }],
        column: { xs: 1, md: 2 },
      },
    })
    const grid = wrapper.find('.fbk-descriptions__grid').element as HTMLElement
    expect(grid.style.getPropertyValue('--fbk-cols-xs')).toBe('1')
    expect(grid.style.getPropertyValue('--fbk-cols-md')).toBe('2')
  })

  it('size 映射到组件令牌，而不是写死像素', () => {
    const wrapper = mount(FbkDescriptions, {
      props: {
        data: { name: 'Alice' },
        items: [{ key: 'name', label: '姓名' }],
        size: 'lg',
      },
    })
    const root = wrapper.element as HTMLElement
    expect(root.style.getPropertyValue('--fbk-descriptions-size')).toBe(
      'var(--fbk-descriptions-size-lg)',
    )
  })
})
