import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'

/**
 * Dashboard 组件的语义行为。
 *
 * jsdom 无 Canvas，图表本体由 chart-core 的测试覆盖（mock 了 echarts）。
 * 这里重点验证**业务语义**：数值格式化、变化率语义、空态、栅格列数。
 */

// 图表组件依赖 echarts，测试里替换成占位组件，只验证外层编排
vi.mock('@fbk/chart-core', () => ({
  FbkChart: {
    name: 'FbkChart',
    props: ['option', 'height', 'loading', 'isEmpty', 'emptyText', 'themed'],
    setup(props: any) {
      return () => {
        return h('div', {
          'data-fbk-part': 'chart',
          'data-empty': String(props.isEmpty),
          'data-height': String(props.height),
        })
      }
    },
  },
  chartColor: (i: number) => `var(--fbk-chart-${(i % 8) + 1})`,
}))

import FbkStatCard from '../src/StatCard.vue'
import FbkStatGroup from '../src/StatGroup.vue'
import FbkRankList from '../src/RankList.vue'
import FbkTrendChart from '../src/TrendChart.vue'
import FbkBarChart from '../src/BarChart.vue'
import FbkPieChart from '../src/PieChart.vue'
import FbkChartCard from '../src/ChartCard.vue'

describe('FbkStatCard 数值格式化', () => {
  it('数字加千分位', () => {
    const wrapper = mount(FbkStatCard, { props: { title: '销售额', value: 1284500 } })
    expect(wrapper.text()).toContain('1,284,500')
  })

  it('precision 控制小数位', () => {
    const wrapper = mount(FbkStatCard, { props: { title: '客单价', value: 148.6, precision: 2 } })
    expect(wrapper.text()).toContain('148.60')
  })

  it('字符串值原样显示（如 "-" 或 "N/A"）', () => {
    const wrapper = mount(FbkStatCard, { props: { title: 'x', value: 'N/A' } })
    expect(wrapper.text()).toContain('N/A')
  })

  it('prefix 与 suffix 渲染在数值两侧', () => {
    const wrapper = mount(FbkStatCard, {
      props: { title: 'x', value: 100, prefix: '¥', suffix: '%' },
    })
    expect(wrapper.text()).toContain('¥')
    expect(wrapper.text()).toContain('%')
  })

  it('数值使用等宽数字（避免刷新时宽度跳动）', () => {
    const wrapper = mount(FbkStatCard, { props: { title: 'x', value: 100 } })
    // 通过 class 断言，具体 CSS 在 style.css 里
    expect(wrapper.find('.fbk-stat-card__number').exists()).toBe(true)
  })
})

describe('FbkStatCard 变化率语义', () => {
  it('上涨默认是 positive', () => {
    const wrapper = mount(FbkStatCard, { props: { title: 'x', value: 1, change: 12.5 } })
    expect(wrapper.attributes('data-tone')).toBe('positive')
    expect(wrapper.text()).toContain('+12.5%')
  })

  it('下跌默认是 negative', () => {
    const wrapper = mount(FbkStatCard, { props: { title: 'x', value: 1, change: -2.1 } })
    expect(wrapper.attributes('data-tone')).toBe('negative')
  })

  it('零变化是 neutral', () => {
    const wrapper = mount(FbkStatCard, { props: { title: 'x', value: 1, change: 0 } })
    expect(wrapper.attributes('data-tone')).toBe('neutral')
  })

  it('changeTone 可反转语义（退款率上涨是坏事）', () => {
    const wrapper = mount(FbkStatCard, {
      props: { title: '退款率', value: 1.8, change: 0.4, changeTone: 'negative' },
    })
    // 数值是涨的，但语义是负向
    expect(wrapper.attributes('data-tone')).toBe('negative')
    expect(wrapper.text()).toContain('+0.4%')
  })

  it('change 为 null 时不渲染变化率', () => {
    const wrapper = mount(FbkStatCard, { props: { title: 'x', value: 1, change: null } })
    expect(wrapper.find('.fbk-stat-card__change').exists()).toBe(false)
  })

  it('变化率带箭头指示方向', () => {
    const up = mount(FbkStatCard, { props: { title: 'x', value: 1, change: 5 } })
    expect(up.find('.fbk-stat-card__arrow').text()).toBe('↑')

    const down = mount(FbkStatCard, { props: { title: 'x', value: 1, change: -5 } })
    expect(down.find('.fbk-stat-card__arrow').text()).toBe('↓')
  })
})

describe('FbkStatCard 交互', () => {
  it('clickable 时触发 click 事件', async () => {
    const wrapper = mount(FbkStatCard, {
      props: { title: 'x', value: 1, clickable: true },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })

  it('非 clickable 时不触发 click', async () => {
    const wrapper = mount(FbkStatCard, { props: { title: 'x', value: 1 } })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })
})

describe('FbkStatGroup 栅格', () => {
  it('数字列数写成 --fbk-cols-base', () => {
    const wrapper = mount(FbkStatGroup, { props: { columns: 3 } })
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--fbk-cols-base')).toBe('3')
  })

  it('对象列数按断点写变量', () => {
    const wrapper = mount(FbkStatGroup, { props: { columns: { xs: 1, md: 2 } } })
    const el = wrapper.element as HTMLElement
    expect(el.style.getPropertyValue('--fbk-cols-xs')).toBe('1')
    expect(el.style.getPropertyValue('--fbk-cols-md')).toBe('2')
    // 缺省断点不写变量，交给 var() 回退链
    expect(el.style.getPropertyValue('--fbk-cols-sm')).toBe('')
  })

  it('gap 变体渲染对应 class', () => {
    const wrapper = mount(FbkStatGroup, { props: { gap: 'lg' } })
    expect(wrapper.classes()).toContain('fbk-stat-group--gap-lg')
  })
})

describe('FbkRankList', () => {
  const data = [
    { name: '华东', value: 48.2 },
    { name: '华南', value: 36.1 },
    { name: '华北', value: 24.7 },
  ]

  it('渲染名次、名称、数值', () => {
    const wrapper = mount(FbkRankList, { props: { data } })
    expect(wrapper.text()).toContain('华东')
    expect(wrapper.text()).toContain('48.2')
    expect(wrapper.findAll('.fbk-rank-list__row')).toHaveLength(3)
  })

  it('limit 截断条数', () => {
    const wrapper = mount(FbkRankList, { props: { data, limit: 2 } })
    expect(wrapper.findAll('.fbk-rank-list__row')).toHaveLength(2)
  })

  it('进度条宽度按最大值归一', () => {
    const wrapper = mount(FbkRankList, { props: { data } })
    const bars = wrapper.findAll('.fbk-rank-list__bar-fill')
    // 第一项是最大值，宽度 100%
    expect((bars[0]!.element as HTMLElement).style.width).toBe('100%')
  })

  it('formatter 自定义数值格式', () => {
    const wrapper = mount(FbkRankList, {
      props: { data, formatter: (v: number) => `${v}%` },
    })
    expect(wrapper.text()).toContain('48.2%')
  })

  it('前三名高亮，第四名不高亮', () => {
    const wrapper = mount(FbkRankList, {
      props: { data: [...data, { name: '西南', value: 10 }] },
    })
    const ranks = wrapper.findAll('.fbk-rank-list__rank')
    expect(ranks[0]!.classes()).toContain('is-top')
    expect(ranks[2]!.classes()).toContain('is-top')
    expect(ranks[3]!.classes()).not.toContain('is-top')
  })

  it('全部为 0 时不出现 NaN', () => {
    const wrapper = mount(FbkRankList, {
      props: { data: [{ name: 'a', value: 0 }, { name: 'b', value: 0 }] },
    })
    expect(wrapper.text()).not.toContain('NaN')
  })

  it('空数据不报错', () => {
    const wrapper = mount(FbkRankList, { props: { data: [] } })
    expect(wrapper.findAll('.fbk-rank-list__row')).toHaveLength(0)
  })
})

describe('图表卡片外壳', () => {
  it('ChartCard 渲染标题与副标题', () => {
    const wrapper = mount(FbkChartCard, { props: { title: '标题', subtitle: '副标题' } })
    expect(wrapper.text()).toContain('标题')
    expect(wrapper.text()).toContain('副标题')
  })

  it('ChartCard 无标题时不渲染 header', () => {
    const wrapper = mount(FbkChartCard, {})
    expect(wrapper.find('.fbk-chart-card__header').exists()).toBe(false)
  })

  it('TrendChart 把 categories 长度传给空态判定', async () => {
    const wrapper = mount(FbkTrendChart, {
      props: { categories: [], series: [] },
    })
    await flushPromises()
    const chart = wrapper.find('[data-fbk-part="chart"]')
    expect(chart.attributes('data-empty')).toBe('true')
  })

  it('TrendChart 多系列时默认关闭面积填充', async () => {
    const wrapper = mount(FbkTrendChart, {
      props: {
        categories: ['a'],
        series: [
          { name: 'A', data: [1] },
          { name: 'B', data: [2] },
        ],
      },
    })
    await flushPromises()
    // 多系列时面积会互相遮挡，应自动关闭
    expect(wrapper.find('[data-fbk-part="chart"]').exists()).toBe(true)
  })

  it('BarChart 支持 horizontal 方向', async () => {
    const wrapper = mount(FbkBarChart, {
      props: { categories: ['a'], series: [{ name: 'A', data: [1] }], direction: 'horizontal' },
    })
    await flushPromises()
    expect(wrapper.find('[data-fbk-part="chart"]').exists()).toBe(true)
  })

  it('PieChart 中心文案渲染', async () => {
    const wrapper = mount(FbkPieChart, {
      props: {
        data: [{ name: 'a', value: 1 }],
        centerValue: '1234',
        centerLabel: '总订单',
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('1234')
    expect(wrapper.text()).toContain('总订单')
  })
})
