/**
 * 变更影响分析（纯函数）。
 *
 * 输入：依赖图 + 变更文件集
 * 输出：分级后的影响集
 *
 * 没有 IO —— 全部可单测。这是刻意的：算法正确性不该靠"跑一遍看看"
 * 来验证，而 `build-graph.mjs` 的外部命令依赖会让测试变得脆弱。
 */

import { normalize } from './build-graph.mjs'

/** 影响等级。数字是「距离改动文件几步」 */
export const LEVELS = {
  changed: 0,
  direct: 1,
  indirect: 3,
  transitive: Number.POSITIVE_INFINITY,
}

/** 按距离归类 */
export function levelOf(distance) {
  if (distance === 0) return 'changed'
  if (distance === 1) return 'direct'
  if (distance <= 3) return 'indirect'
  return 'transitive'
}

/**
 * 从目录推断「新增文件可能被谁引用」。
 *
 * 新增文件不在图里，没法走反向边。用目录前缀做保守推断：
 * 例如新增 `packages/components/src/pro-table/NewThing.vue`，
 * 就认为同目录及其 `index.ts` 可能引用它。
 */
function guessDependentsForNewFile(file, nodes) {
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.'
  const out = []
  for (const node of nodes) {
    const nodeDir = node.includes('/') ? node.slice(0, node.lastIndexOf('/')) : '.'
    // 同目录的文件，或同目录的 index.*
    if (nodeDir === dir) out.push(node)
    // 父目录的 index.ts（barrel）
    else if (nodeDir === dir.slice(0, dir.lastIndexOf('/')) && /^index\.[a-z]+$/.test(node.split('/').pop()))
      out.push(node)
  }
  return out
}

/**
 * 反向传递闭包。
 *
 * BFS 而非 DFS：BFS 天然给出最短距离，而距离决定影响等级。
 *
 * @param {{ reverse: Map<string, Set<string>>, nodes: Set<string> }} graph
 * @param {string[]} changedFiles
 * @returns {{ file: string, distance: number, level: string }[]}
 */
/**
 * @param graph 文件级图
 * @param changedFiles 变更文件
 * @param pkgCtx 可选的包级上下文 { reverse, dirs }
 *   —— 文件级图不跨包，靠它补上 components → data 这类传播
 */
export function analyzeImpact(graph, changedFiles, pkgCtx) {
  const { reverse, nodes } = graph

  /* Node 内置模块与裸模块名不是仓库里的文件，不该出现在影响清单里。
     它们会从 depcruise 的图里漏进来（unresolved 的 import）。 */
  const isRealFile = (f) => f.includes('/') || /\.(m?[jt]sx?|vue|css|json)$/.test(f)

  const changed = [...new Set(changedFiles.map(normalize).filter(Boolean))]

  /** file → 最小距离 */
  const distance = new Map()

  for (const file of changed) {
    distance.set(file, 0)

    /* 新增文件不在图里时，用目录推断补齐第一层。
       这一步只在「该文件不是任何节点的依赖目标」时才做 ——
       否则会把已有文件误判为新增。 */
    if (!reverse.has(file)) {
      for (const guess of guessDependentsForNewFile(file, nodes)) {
        if (!distance.has(guess)) distance.set(guess, 1)
      }
    }
  }

  // BFS：从所有变更文件同时出发
  const queue = [...distance.keys()].map((file) => ({ file, dist: distance.get(file) }))

  while (queue.length > 0) {
    const { file, dist } = queue.shift()
    const dependents = reverse.get(file)
    if (!dependents) continue

    for (const dep of dependents) {
      const next = dist + 1
      const known = distance.get(dep)
      if (known === undefined || next < known) {
        distance.set(dep, next)
        queue.push({ file: dep, dist: next })
      }
    }
  }

  /* 包级传播。
     文件级图里 components 引用的是 `@fbkworks/data` 包名，
     depcruise 的 doNotFollow 把它排除了，所以「改了 data 的契约」
     分析不出 components 受影响。

     **不把受影响包的所有文件塞进文件清单** —— 那会产生几十条
     「某组件包里的某个 .vue 受影响」的噪音，读者反而看不到重点。
     改为单独列出「整包受影响」，让判断变成「要不要重测这个包」。 */
  let affectedPkgs = []
  if (pkgCtx) {
    const seed = new Set()
    for (const file of changed) {
      const pkg = pkgCtx.packageOfFile(file)
      if (pkg) seed.add(pkg)
    }
    if (seed.size > 0) {
      const all = pkgCtx.affectedPackages(seed)
      // 只列「因依赖而受影响」的包，种子包本身是改动来源，单独显示
      affectedPkgs = [...all].filter((p) => !seed.has(p)).sort()
    }
  }

  const results = (
    [...distance.entries()]
      /* Node 内置模块（child_process / fs）与裸模块名不是仓库文件，
         会从 depcruise 的图里漏进来（unresolved 的 import），必须滤掉 ——
         否则报告里会出现「child_process 受影响」这种没有意义的一行。 */
      .filter(([file]) => isRealFile(file))
      .map(([file, dist]) => ({ file, distance: dist, level: levelOf(dist) }))
      /* 测试文件从影响清单里移除 ——
         它们随源码变化是必然的，列出来只会稀释真正需要看的部分。
         改动的**本身**是测试时仍然保留（那是「改动」，不是「影响」）。 */
      .filter((item) => item.distance === 0 || !isTestFile(item.file))
      .sort((a, b) => a.distance - b.distance || a.file.localeCompare(b.file))
  )

  /* 用非枚举属性挂受影响包 —— 保持返回值仍是数组（调用方无感），
     同时把包级信息带出去。 */
  Object.defineProperty(results, 'affectedPackages', {
    value: affectedPkgs,
    enumerable: false,
  })
  return results
}

/** 是否为测试文件。测试是验证手段，不是「需要验证的对象」 */
export function isTestFile(file) {
  return /(^|\/)tests\//.test(file) || /\.spec\.(ts|tsx)$/.test(file) || /\.test\.(ts|tsx)$/.test(file)
}

/** 从文件路径取出所属包名（packages/x 或 apps/x） */
export function packageOf(file) {
  const m = /^(?:packages|apps|tests)\/((?:adapters|internal)\/)?([a-zA-Z0-9-]+)/.exec(file)
  if (!m) return null
  const scope = m[1] ? `${m[1].replace('/', '-')}` : ''
  return scope ? `${scope}${m[2]}` : m[2]
}

/**
 * 汇总成便于阅读的结构。
 *
 * @param {{file:string,distance:number,level:string}[]} impacts
 */
export function summarize(impacts) {
  const affectedPkgs = impacts.affectedPackages ?? []
  const byLevel = { changed: [], direct: [], indirect: [], transitive: [] }
  for (const item of impacts) {
    byLevel[item.level].push(item)
  }

  /* 受影响的应用：只统计 apps/ 下的文件。
     应用是最终消费者 —— 「影响 12 个组件」不如「影响 admin 的 3 个页面」直观。 */
  const apps = new Map()
  for (const item of impacts) {
    if (!item.file.startsWith('apps/')) continue
    const pkg = packageOf(item.file)
    if (!pkg) continue
    if (!apps.has(pkg)) apps.set(pkg, [])
    apps.get(pkg).push(item.file)
  }

  /* 受影响的发布包。用于决定跑哪些包的测试 */
  const packages = new Set()
  for (const item of impacts) {
    const pkg = packageOf(item.file)
    if (pkg && item.file.startsWith('packages/')) packages.add(pkg)
  }

  return {
    byLevel,
    apps: [...apps.entries()].map(([name, files]) => ({ name, files })),
    packages: [...packages].sort(),
    /* 因包级依赖而整包受影响的 —— 与「文件级直接影响」区分开，
       否则清单里会全是某个包的 .vue 文件，看不到重点 */
    affectedPackages: affectedPkgs,
    total: impacts.length,
  }
}

/** 配置文件变更视为全量影响 —— 它可能改变构建、类型、测试任一方面 */
const GLOBAL_CONFIG_PATTERNS = [
  /^package\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^tsconfig.*\.json$/,
  /^vitest\.config\./,
  /^eslint\.config\./,
  /^dependency-cruiser\.config\./,
  /^turbo\.json$/,
  /^pnpm-lock\.yaml$/,
]

export function isGlobalConfig(file) {
  const f = normalize(file) ?? ''
  const basename = f.includes('/') ? f.slice(f.lastIndexOf('/') + 1) : f

  /* 任何 package.json 都算全量影响 —— 依赖变了，
     整个包甚至整个仓库的兼容性都可能变。
     这比「只看仓库根」保守，但漏判的代价更高。 */
  if (basename === 'package.json') return true

  // 其余配置只看仓库根或一层目录（packages/x/tsconfig.json 这类）
  const depth = f.split('/').length
  if (depth > 2) return false
  return GLOBAL_CONFIG_PATTERNS.some((re) => re.test(f) || re.test(basename))
}

/**
 * 建议的验证命令。
 *
 * 只给「值得跑」的，而不是把全部命令列一遍 ——
 * 列太多等于没建议。
 */
export function suggestChecks(summary, globals) {
  const out = []

  if (globals.length > 0) {
    out.push('pnpm verify   # 配置变更，建议全量验证')
    return out
  }

  /* 受影响的发布包 → 跑它们的单测。
     同时覆盖两种情况：
       summary.packages      —— 文件级影响到的包
       summary.affectedPackages —— 因包级依赖而整包受影响的

     后者尤其重要：改了 @fbkworks/data 的契约，components 的测试必须重跑，
     否则「类型不兼容」要靠运行时才发现。 */
  const TESTABLE = [
    'tokens',
    'shared',
    'data',
    'adapter-core',
    'components',
    'chart-core',
    'dashboard',
    'screen',
  ]
  const fromFiles = summary.packages.filter((p) => TESTABLE.includes(p))
  const fromPackages = (summary.affectedPackages ?? [])
    .map((p) => p.replace('@fbkworks/', ''))
    .filter((p) => TESTABLE.includes(p))

  for (const pkg of [...new Set([...fromFiles, ...fromPackages])]) {
    out.push(`pnpm --filter @fbkworks/${pkg} test`)
  }

  // 受影响的应用 → 跑对应的浏览器实测
  const appScripts = {
    admin: 'python scripts/visual/verify-admin.py',
    playground: 'python scripts/visual/verify-playground.py',
  }
  for (const app of summary.apps) {
    const script = appScripts[app.name]
    if (script) out.push(script)
  }

  if (out.length === 0) {
    // 只改了 demo / 文档，跑一次最快的浏览器实测
    out.push('python scripts/visual/verify-playground.py')
  }

  return out
}
