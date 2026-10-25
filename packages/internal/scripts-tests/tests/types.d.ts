/**
 * 仓库脚本是纯 .mjs（不走 TS 构建），但测试要用 TS 写。
 *
 * 这里给 analyze.mjs 补一份最小声明 —— 只声明测试用到的形状。
 * 不追求完整：如果脚本的接口变了，测试会因为行为不符而失败，
 * 这比类型签名漂移更容易发现。
 */
declare module '*/scripts/lib/analyze.mjs' {
  export interface Graph {
    reverse: Map<string, Set<string>>
    nodes: Set<string>
  }

  export interface Impact {
    file: string
    distance: number
    level: 'changed' | 'direct' | 'indirect' | 'transitive'
  }

  export type ImpactList = Impact[] & { affectedPackages: string[] }

  export interface PackageContext {
    dirs: Map<string, string>
    packageOfFile: (file: string) => string | null
    affectedPackages: (seed: Set<string>) => Set<string>
  }

  export interface Summary {
    byLevel: Record<string, Impact[]>
    apps: Array<{ name: string; files: string[] }>
    packages: string[]
    affectedPackages: string[]
    total: number
  }

  export const LEVELS: Record<string, number>
  export function levelOf(distance: number): string
  export function analyzeImpact(
    graph: Graph,
    changedFiles: string[],
    pkgCtx?: PackageContext,
  ): ImpactList
  export function isTestFile(file: string): boolean
  export function packageOf(file: string): string | null
  export function summarize(impacts: Impact[]): Summary
  export function isGlobalConfig(file: string): boolean
  /* suggestChecks 只读三个字段，所以接受部分 Summary ——
     测试里不需要为了跑它去构造 byLevel / total。 */
  export function suggestChecks(
    summary: Pick<Summary, 'packages' | 'affectedPackages' | 'apps'>,
    globals: string[],
  ): string[]
}
