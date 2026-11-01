import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import {
  FbkScreenBarChart,
  FbkScreenGaugeChart,
  FbkScreenLineChart,
  FbkScreenPieChart,
} from '../src'

/**
 * 图表 option 快照（大屏）。
 *
 * 与 dashboard 那份同一套理由：D 重构要把重复的 option 片段抽到 chart-core，
 * 而 jsdom 测不出图表长什么样，唯一的安全网是「重构前后 option 深度相等」。
 *
 * 注意大屏与 dashboard 的差异是**有意的皮肤**（字号 14、柱宽 28、发光阴影、
 * 面积透明度 0.18），基线会把它们钉住 —— 重构不得改变任何一个值。
 */

const captured: unknown[] = []

/* 只替换 FbkChart，其余导出保留真实实现 —— mock 里复制一份的话，
   真实零件的改动不会反映到快照上，守卫就失效了。 */
vi.mock('@fbkworks/chart-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@fbkworks/chart-core')>()
  return {
    ...actual,
    FbkChart: {
      name: 'FbkChart',
      props: ['option', 'height', 'loading', 'isEmpty', 'emptyText', 'themed'],
      setup(props: { option: unknown }) {
        captured.push(props.option)
        return () => h('div', { 'data-fbk-part': 'chart' })
      },
    },
  }
})

const FIXTURE_DIR = join(import.meta.dirname, '__fixtures__')
const UPDATE = process.env.FBK_UPDATE_CHART_FIXTURES === '1'

const categories = ['一月', '二月', '三月']

const CASES = [
  {
    name: 'screen-gauge-default',
    component: FbkScreenGaugeChart,
    props: { value: 76.4, unit: '%', label: '转化率' },
  },
  {
    name: 'screen-gauge-custom-max',
    component: FbkScreenGaugeChart,
    props: { value: 4000, max: 8000, unit: '单', label: '今日订单' },
  },
  {
    name: 'screen-bar-default',
    component: FbkScreenBarChart,
    props: { categories, series: [{ name: '销量', data: [10, 20, 30] }] },
  },
  {
    name: 'screen-bar-multi-series',
    component: FbkScreenBarChart,
    props: {
      categories,
      series: [
        { name: '销量', data: [10, 20, 30] },
        { name: '同比', data: [5, 8, 12] },
      ],
    },
  },
  {
    name: 'screen-bar-stacked',
    component: FbkScreenBarChart,
    props: {
      categories,
      stacked: true,
      series: [
        { name: '销量', data: [10, 20, 30] },
        { name: '同比', data: [5, 8, 12] },
      ],
    },
  },
  {
    name: 'screen-line-default',
    component: FbkScreenLineChart,
    props: { categories, series: [{ name: '访问', data: [1, 2, 3] }] },
  },
  {
    name: 'screen-line-multi-area',
    component: FbkScreenLineChart,
    props: {
      categories,
      area: true,
      smooth: true,
      series: [
        { name: '访问', data: [1, 2, 3] },
        { name: '下单', data: [2, 3, 4] },
      ],
    },
  },
  {
    name: 'screen-line-no-area',
    component: FbkScreenLineChart,
    props: { categories, area: false, smooth: false, series: [{ name: '访问', data: [1, 2, 3] }] },
  },
  {
    name: 'screen-pie-solid',
    component: FbkScreenPieChart,
    props: { innerRadius: 0, data: [{ name: '直营', value: 60 }, { name: '分销', value: 40 }] },
  },
  {
    name: 'screen-pie-ring-center',
    component: FbkScreenPieChart,
    props: {
      innerRadius: 0.6,
      centerValue: 12480,
      centerLabel: '总订单',
      data: [
        { name: '直营', value: 60 },
        { name: '分销', value: 40, color: '#abcdef' },
      ],
    },
  },
]

describe('图表 option 快照（screen）', () => {
  for (const testCase of CASES) {
    it(`${testCase.name}`, async () => {
      captured.length = 0
      // CASES 里各家 props 形状不同，这里按运行时传入；类型由各自的用例保证
      const wrapper = mount(testCase.component as any, { props: testCase.props as any })
      await flushPromises()

      const option = captured.at(-1)
      expect(option, '没有捕获到 FbkChart 的 option').toBeDefined()

      const file = join(FIXTURE_DIR, `${testCase.name}.json`)
      if (UPDATE) {
        mkdirSync(FIXTURE_DIR, { recursive: true })
        writeFileSync(file, `${JSON.stringify(option, null, 2)}\n`)
      }
      expect(
        existsSync(file),
        `缺少基线 ${file} —— 先运行 pnpm gen:chart-fixtures`,
      ).toBe(true)

      expect(option).toEqual(JSON.parse(readFileSync(file, 'utf8')))
      wrapper.unmount()
    })
  }
})
