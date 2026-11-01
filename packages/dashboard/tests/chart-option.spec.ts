import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { FbkBarChart, FbkPieChart, FbkTrendChart } from '../src'

/**
 * 图表 option 快照。
 *
 * 存在理由：D 重构要把六个图表组件里重复的 option 片段抽到 chart-core，
 * 而 **jsdom 测不出图表长什么样** —— 唯一可靠的安全网是「重构前后的 option 深度相等」。
 *
 * 覆盖每一处会使 option 分叉的 props 分支：
 *   BarChart   series.length > 1（legend 出现）/ stacked / direction=horizontal（轴互换 + 圆角方向）
 *   TrendChart series.length > 1 / area / smooth / startFromZero
 *   PieChart   innerRadius=0（实心）/ >0（环形）/ data 里的自定义 color
 *
 * 基线由 `pnpm gen:chart-fixtures` 生成。**不自动重建** —— 缺文件就红，
 * 免得「改坏了配置 → 顺手重新生成 → 静默掩盖」。
 */

const captured: unknown[] = []

/* 只替换 FbkChart，其余导出（seriesColor / barRadius …）保留真实实现 ——
   在 mock 里复制一份的话，真实零件的改动不会反映到快照上，守卫就失效了。 */
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

interface Case {
  name: string
  component: unknown
  props: Record<string, unknown>
}

const CASES: Case[] = [
  {
    name: 'bar-default',
    component: FbkBarChart,
    props: { categories, series: [{ name: '销量', data: [10, 20, 30] }] },
  },
  {
    name: 'bar-multi-series',
    component: FbkBarChart,
    props: {
      categories,
      series: [
        { name: '销量', data: [10, 20, 30] },
        { name: '同比', data: [5, 8, 12] },
      ],
    },
  },
  {
    name: 'bar-stacked',
    component: FbkBarChart,
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
    name: 'bar-horizontal',
    component: FbkBarChart,
    props: { categories, direction: 'horizontal', series: [{ name: '销量', data: [10, 20, 30] }] },
  },
  {
    name: 'trend-default',
    component: FbkTrendChart,
    props: { categories, series: [{ name: '访问', data: [1, 2, 3] }] },
  },
  {
    name: 'trend-multi-area',
    component: FbkTrendChart,
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
    name: 'trend-no-area-no-zero',
    component: FbkTrendChart,
    props: {
      categories,
      area: false,
      smooth: false,
      startFromZero: false,
      series: [{ name: '访问', data: [1, 2, 3] }],
    },
  },
  {
    name: 'pie-solid',
    component: FbkPieChart,
    props: { innerRadius: 0, data: [{ name: '直营', value: 60 }, { name: '分销', value: 40 }] },
  },
  {
    name: 'pie-ring-custom-color',
    component: FbkPieChart,
    props: {
      innerRadius: 0.62,
      data: [
        { name: '直营', value: 60 },
        { name: '分销', value: 40, color: '#123456' },
      ],
    },
  },
]

describe('图表 option 快照（dashboard）', () => {
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
