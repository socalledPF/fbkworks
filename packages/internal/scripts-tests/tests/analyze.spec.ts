import { describe, expect, it } from 'vitest'
import {
  analyzeImpact,
  isGlobalConfig,
  isTestFile,
  levelOf,
  suggestChecks,
  summarize,
} from '../../../../scripts/lib/analyze.mjs'
import type { Graph } from '../../../../scripts/lib/analyze.mjs'

/**
 * 变更影响分析的核心算法。
 *
 * 这是纯函数，没有 IO —— 算法正确性必须靠测试而不是「跑一遍看看」。
 *
 * 图的结构：reverse 是「谁依赖我」，因为分析只需要反向遍历。
 */

/** 用邻接表快速造一张图：{ 'a.ts': ['b.ts'] } 表示 b 依赖 a */
function makeGraph(edges: Record<string, string[]>): Graph {
  const reverse = new Map<string, Set<string>>()
  const nodes = new Set<string>()

  for (const [target, dependents] of Object.entries(edges)) {
    nodes.add(target)
    for (const dep of dependents) {
      nodes.add(dep)
      if (!reverse.has(target)) reverse.set(target, new Set())
      reverse.get(target)!.add(dep)
    }
  }
  return { reverse, nodes }
}

describe('levelOf', () => {
  it('按距离分级', () => {
    expect(levelOf(0)).toBe('changed')
    expect(levelOf(1)).toBe('direct')
    expect(levelOf(2)).toBe('indirect')
    expect(levelOf(3)).toBe('indirect')
    expect(levelOf(4)).toBe('transitive')
  })
})

describe('直接与间接影响', () => {
  const graph = makeGraph({
    'a.ts': ['b.ts'],
    'b.ts': ['c.ts'],
    'c.ts': ['d.ts'],
  })

  it('第一层是直接，2-3 层是间接，更深是深层影响', () => {
    const result = analyzeImpact(graph, ['a.ts'])
    const byFile = Object.fromEntries(result.map((r) => [r.file, r.level]))

    expect(byFile['a.ts']).toBe('changed')
    expect(byFile['b.ts']).toBe('direct')      // 距离 1
    expect(byFile['c.ts']).toBe('indirect')    // 距离 2
    expect(byFile['d.ts']).toBe('indirect')    // 距离 3，仍是间接
  })

  it('超过 3 层算深层影响', () => {
    const deep = makeGraph({
      'a.ts': ['b.ts'],
      'b.ts': ['c.ts'],
      'c.ts': ['d.ts'],
      'd.ts': ['e.ts'],
    })
    const result = analyzeImpact(deep, ['a.ts'])
    const byFile = Object.fromEntries(result.map((r) => [r.file, r.level]))
    expect(byFile['e.ts']).toBe('transitive')  // 距离 4
  })

  it('取最短距离（不是任意路径）', () => {
    /* 菱形：x → a → c，x → c（直接）
       c 的距离应该是 1，不是 2 */
    const g = makeGraph({
      'x.ts': ['a.ts', 'c.ts'],
      'a.ts': ['c.ts'],
    })
    const result = analyzeImpact(g, ['x.ts'])
    expect(result.find((r) => r.file === 'c.ts')!.distance).toBe(1)
  })
})

describe('循环依赖', () => {
  it('不会死循环，且距离正确', () => {
    const graph = makeGraph({
      'a.ts': ['b.ts'],
      'b.ts': ['a.ts'],
    })
    const result = analyzeImpact(graph, ['a.ts'])
    // 不挂就是通过
    expect(result.length).toBeGreaterThan(0)
    expect(result.find((r) => r.file === 'a.ts')!.distance).toBe(0)
  })

  it('自引用也不挂', () => {
    const graph = makeGraph({ 'a.ts': ['a.ts'] })
    expect(() => analyzeImpact(graph, ['a.ts'])).not.toThrow()
  })
})

describe('新增文件（不在图里）', () => {
  it('用同目录推断出依赖者', () => {
    const graph: Graph = {
      reverse: new Map(),
      nodes: new Set([
        'packages/components/src/pro-table/index.ts',
        'packages/components/src/pro-table/ProTable.vue',
      ]),
    }
    const result = analyzeImpact(graph, ['packages/components/src/pro-table/NewThing.vue'])

    const files = result.map((r) => r.file)
    expect(files).toContain('packages/components/src/pro-table/index.ts')
    expect(files).toContain('packages/components/src/pro-table/ProTable.vue')
  })

  it('不受同目录外的文件影响', () => {
    const graph: Graph = {
      reverse: new Map(),
      nodes: new Set(['packages/components/src/other/Thing.vue']),
    }
    const result = analyzeImpact(graph, ['packages/components/src/pro-table/New.vue'])
    expect(result.map((r) => r.file)).not.toContain('packages/components/src/other/Thing.vue')
  })
})

describe('测试文件过滤', () => {
  it('isTestFile 识别常见形态', () => {
    expect(isTestFile('packages/x/tests/a.spec.ts')).toBe(true)
    expect(isTestFile('packages/x/src/a.spec.ts')).toBe(true)
    expect(isTestFile('packages/x/src/a.test.ts')).toBe(true)
    expect(isTestFile('packages/x/src/a.ts')).toBe(false)
  })

  it('影响清单里不含下游测试文件', () => {
    const graph = makeGraph({
      'src/a.ts': ['src/b.ts', 'tests/a.spec.ts'],
    })
    const result = analyzeImpact(graph, ['src/a.ts'])
    expect(result.map((r) => r.file)).toContain('src/b.ts')
    expect(result.map((r) => r.file)).not.toContain('tests/a.spec.ts')
  })

  it('改动本身是测试文件时保留（那是改动，不是影响）', () => {
    const graph = makeGraph({ 'tests/a.spec.ts': ['src/b.ts'] })
    const result = analyzeImpact(graph, ['tests/a.spec.ts'])
    expect(result.find((r) => r.file === 'tests/a.spec.ts')!.level).toBe('changed')
  })
})

describe('包级传播', () => {
  /** 文件级图：data 包内部，跨包边不存在 */
  const graph = makeGraph({ 'packages/data/src/types.ts': ['packages/data/src/index.ts'] })

  const pkgCtx = {
    dirs: new Map([
      ['@fbk/data', 'packages/data'],
      ['@fbk/components', 'packages/components'],
    ]),
    packageOfFile: (f: string) =>
      f.startsWith('packages/data') ? '@fbk/data' : f.startsWith('packages/components') ? '@fbk/components' : null,
    // components 依赖 data
    affectedPackages: () => new Set(['@fbk/data', '@fbk/components']),
  }

  it('依赖包整包受影响，但不拆成文件清单', () => {
    const result = analyzeImpact(graph, ['packages/data/src/types.ts'], pkgCtx)

    expect(result.affectedPackages).toContain('@fbk/components')
    // 不把 components 的文件塞进清单
    expect(result.map((r) => r.file)).not.toContain('packages/components/src/pro-table/ProTable.vue')
  })

  it('种子包自己不算「受影响」（它是改动来源）', () => {
    const result = analyzeImpact(graph, ['packages/data/src/types.ts'], pkgCtx)
    expect(result.affectedPackages).not.toContain('@fbk/data')
  })

  it('没传 pkgCtx 时行为不变（向后兼容）', () => {
    const result = analyzeImpact(graph, ['packages/data/src/types.ts'])
    expect(result.affectedPackages).toEqual([])
  })
})

describe('配置变更判定', () => {
  it('仓库根配置视为全量', () => {
    expect(isGlobalConfig('package.json')).toBe(true)
    expect(isGlobalConfig('pnpm-lock.yaml')).toBe(true)
    expect(isGlobalConfig('tsconfig.base.json')).toBe(true)
    expect(isGlobalConfig('vitest.config.ts')).toBe(true)
  })

  it('源码文件不算配置', () => {
    expect(isGlobalConfig('packages/data/src/types.ts')).toBe(false)
  })

  it('包内的 package.json 视为全量（依赖变了）', () => {
    expect(isGlobalConfig('packages/data/package.json')).toBe(true)
  })

  it('任何位置的 package.json 都算配置变更', () => {
    // 依赖声明变了，整个仓库的兼容性都可能变 —— 宁可保守
    expect(isGlobalConfig('packages/x/src/package.json')).toBe(true)
  })

  it('深层非配置文件不误判', () => {
    expect(isGlobalConfig('packages/x/src/deep/a.ts')).toBe(false)
    expect(isGlobalConfig('packages/x/tsconfig.json')).toBe(false)
  })
})

describe('summarize', () => {
  it('按等级分组并统计应用', () => {
    const graph = makeGraph({
      'packages/components/src/a.ts': ['apps/admin/src/Page.vue'],
      'apps/admin/src/Page.vue': ['apps/admin/src/App.vue'],
    })
    const summary = summarize(analyzeImpact(graph, ['packages/components/src/a.ts']))

    expect(summary.byLevel.changed).toHaveLength(1)
    expect(summary.byLevel.direct).toHaveLength(1)
    expect(summary.apps.map((a) => a.name)).toContain('admin')
  })
})

describe('suggestChecks', () => {
  it('配置变更时只给全量验证', () => {
    const summary = { packages: ['components'], affectedPackages: [], apps: [] }
    const checks = suggestChecks(summary, ['package.json'])
    expect(checks).toHaveLength(1)
    expect(checks[0]).toContain('verify')
  })

  it('受影响的包跑对应单测', () => {
    const summary = { packages: ['components'], affectedPackages: [], apps: [] }
    const checks = suggestChecks(summary, [])
    expect(checks).toContain('pnpm --filter @fbk/components test')
  })

  it('整包受影响的包也要跑单测', () => {
    // 改了 data 的契约，components 的类型依赖它，必须重跑
    const summary = {
      packages: ['data'],
      affectedPackages: ['@fbk/components'],
      apps: [],
    }
    const checks = suggestChecks(summary, [])
    expect(checks).toContain('pnpm --filter @fbk/data test')
    expect(checks).toContain('pnpm --filter @fbk/components test')
  })

  it('受影响应用跑对应浏览器实测', () => {
    const summary = {
      packages: [],
      affectedPackages: [],
      apps: [{ name: 'admin', files: [] }],
    }
    const checks = suggestChecks(summary, [])
    expect(checks.some((c) => c.includes('verify-admin'))).toBe(true)
  })

  it('什么都没有时给一个兜底检查', () => {
    const checks = suggestChecks({ packages: [], affectedPackages: [], apps: [] }, [])
    expect(checks.length).toBeGreaterThan(0)
  })
})
