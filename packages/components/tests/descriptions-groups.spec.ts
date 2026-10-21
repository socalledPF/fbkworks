import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { FbkDescriptions } from '../src/descriptions'

/**
 * 分组与折叠。
 *
 * 详情页常见「基本信息 / 联系方式 / 扩展属性」三段式，
 * 此前只能用多个 Descriptions 拼，标题层级与间距都要手动对齐。
 */
const items = [
  { key: 'name', label: '姓名', groups: ['basic'] },
  { key: 'age', label: '年龄', groups: ['basic'] },
  { key: 'phone', label: '电话', groups: ['contact'] },
  { key: 'email', label: '邮箱', groups: ['contact'] },
]
const data = { name: 'Alice', age: 30, phone: '123', email: 'a@b.c' }

const groups = [
  { key: 'basic', title: '基本信息' },
  { key: 'contact', title: '联系方式' },
]

describe('Descriptions 分组', () => {
  it('按 item.groups 归组渲染', () => {
    const wrapper = mount(FbkDescriptions, { props: { data, items, groups } })

    const basic = wrapper.find('[data-group="basic"]')
    const contact = wrapper.find('[data-group="contact"]')
    expect(basic.exists()).toBe(true)
    expect(contact.exists()).toBe(true)

    expect(basic.text()).toContain('姓名')
    expect(basic.text()).toContain('年龄')
    expect(basic.text()).not.toContain('电话')
    expect(contact.text()).toContain('电话')
  })

  it('分组标题渲染为 h3', () => {
    const wrapper = mount(FbkDescriptions, { props: { data, items, groups } })
    expect(wrapper.findAll('.fbk-descriptions__group-title').map((h) => h.text())).toEqual([
      '基本信息',
      '联系方式',
    ])
  })

  it('不传 groups 时保持原有单块渲染（向后兼容）', () => {
    const wrapper = mount(FbkDescriptions, {
      props: { data, items: [{ key: 'name', label: '姓名' }] },
    })
    expect(wrapper.findAll('.fbk-descriptions__group')).toHaveLength(1)
    expect(wrapper.find('.fbk-descriptions__group-title').exists()).toBe(false)
  })

  it('未声明 groups 的条目归入第一个分组', () => {
    const wrapper = mount(FbkDescriptions, {
      props: {
        data,
        items: [{ key: 'name', label: '姓名' }, { key: 'phone', label: '电话', groups: ['contact'] }],
        groups,
      },
    })
    expect(wrapper.find('[data-group="basic"]').text()).toContain('姓名')
  })

  it('group key 写错的条目不丢数据，落到无标题区', () => {
    // 静默丢字段是最难排查的问题之一，宁可多渲染一个区块
    const wrapper = mount(FbkDescriptions, {
      props: {
        data,
        items: [
          { key: 'name', label: '姓名', groups: ['basic'] },
          { key: 'typo', label: '拼错的组', groups: ['nonexistent'] },
        ],
        groups,
      },
    })
    expect(wrapper.find('[data-group="__orphans__"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('拼错的组')
  })

  it('空分组不渲染', () => {
    const wrapper = mount(FbkDescriptions, {
      props: {
        data,
        items: [{ key: 'name', label: '姓名', groups: ['basic'] }],
        groups,
      },
    })
    expect(wrapper.find('[data-group="basic"]').exists()).toBe(true)
    expect(wrapper.find('[data-group="contact"]').exists()).toBe(false)
  })

  it('一个条目可以同时出现在多个分组', () => {
    const wrapper = mount(FbkDescriptions, {
      props: {
        data,
        items: [{ key: 'name', label: '姓名', groups: ['basic', 'contact'] }],
        groups,
      },
    })
    expect(wrapper.find('[data-group="basic"]').text()).toContain('姓名')
    expect(wrapper.find('[data-group="contact"]').text()).toContain('姓名')
  })

  it('分组级 column 覆盖组件级 column', () => {
    const wrapper = mount(FbkDescriptions, {
      props: {
        data,
        items,
        column: 2,
        groups: [{ key: 'basic', title: '基本信息', column: 3 }, { key: 'contact', title: '联系方式' }],
      },
    })
    const basic = wrapper.find('[data-group="basic"] .fbk-descriptions__grid').element as HTMLElement
    const contact = wrapper.find('[data-group="contact"] .fbk-descriptions__grid').element as HTMLElement

    expect(basic.style.getPropertyValue('--fbk-cols-base')).toBe('3')
    expect(contact.style.getPropertyValue('--fbk-cols-base')).toBe('2')
  })
})

describe('Descriptions 分组折叠', () => {
  const collapsibleGroups = [
    { key: 'basic', title: '基本信息', collapsible: true },
    { key: 'contact', title: '联系方式', collapsible: true, defaultCollapsed: true },
  ]

  it('可折叠分组渲染折叠按钮', () => {
    const wrapper = mount(FbkDescriptions, { props: { data, items, groups: collapsibleGroups } })
    expect(wrapper.findAll('.fbk-descriptions__group-toggle')).toHaveLength(2)
  })

  it('defaultCollapsed 生效', () => {
    const wrapper = mount(FbkDescriptions, { props: { data, items, groups: collapsibleGroups } })
    const basic = wrapper.find('[data-group="basic"] .fbk-descriptions__grid')
    const contact = wrapper.find('[data-group="contact"] .fbk-descriptions__grid')

    // v-show 用 display: none 隐藏
    expect((basic.element as HTMLElement).style.display).not.toBe('none')
    expect((contact.element as HTMLElement).style.display).toBe('none')
  })

  it('点击切换折叠状态', async () => {
    const wrapper = mount(FbkDescriptions, { props: { data, items, groups: collapsibleGroups } })
    const basicToggle = wrapper.find('[data-group="basic"] .fbk-descriptions__group-toggle')

    expect(basicToggle.attributes('aria-expanded')).toBe('true')
    await basicToggle.trigger('click')

    const grid = wrapper.find('[data-group="basic"] .fbk-descriptions__grid')
    expect((grid.element as HTMLElement).style.display).toBe('none')
    expect(basicToggle.attributes('aria-expanded')).toBe('false')
  })

  it('折叠按钮带 aria-expanded（可访问性）', () => {
    const wrapper = mount(FbkDescriptions, { props: { data, items, groups: collapsibleGroups } })
    const toggles = wrapper.findAll('.fbk-descriptions__group-toggle')
    for (const toggle of toggles) {
      expect(toggle.attributes('aria-expanded')).toMatch(/true|false/)
    }
  })

  it('不可折叠分组不渲染按钮，只渲染标题', () => {
    const wrapper = mount(FbkDescriptions, { props: { data, items, groups } })
    expect(wrapper.findAll('.fbk-descriptions__group-toggle')).toHaveLength(0)
    expect(wrapper.findAll('.fbk-descriptions__group-title')).toHaveLength(2)
  })
})

describe('Descriptions 条目增强', () => {
  it('emptyText 覆盖默认占位符', () => {
    const wrapper = mount(FbkDescriptions, {
      props: {
        data: { name: null },
        items: [{ key: 'name', label: '姓名', emptyText: '未填写' }],
      },
    })
    expect(wrapper.text()).toContain('未填写')
  })

  it('render 返回 VNode 时正确渲染', () => {
    const wrapper = mount(FbkDescriptions, {
      props: {
        data: { amount: 100 },
        items: [
          {
            key: 'amount',
            label: '金额',
            render: ({ value }: any) => `¥${value}`,
          },
        ],
      },
    })
    expect(wrapper.text()).toContain('¥100')
  })
})
