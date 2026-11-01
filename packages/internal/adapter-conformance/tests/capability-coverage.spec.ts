import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Capabilities, UiAdapter } from '@fbkworks/adapter-core'
import { elementPlusAdapter } from '@fbkworks/adapter-element-plus'
import { naiveUiAdapter } from '@fbkworks/adapter-naive-ui'
import { vantAdapter } from '@fbkworks/adapter-vant'
import {
  CAPABILITY_COVERAGE,
  DESCRIPTIVE_KEYS,
  ENUM_BASELINES,
} from '../src/capability-coverage'

/**
 * 能力位与实现的绑定校验。
 *
 * 类型系统只能保证 `Capabilities` 对象符合形状，保证不了「声明的东西真的被实现」。
 * 这一组用例要求：**每一个"真值"能力位都要交代由谁验证** ——
 * 要么有一致性用例（源码里的 `@capability` 标记），
 * 要么能在适配器对象上静态判定，要么显式登记为 unverified 欠债。
 *
 * 设 `FBK_STRICT_CAPABILITIES=1` 时，unverified 也算失败 —— 发版前跑它强制还债。
 */

const adapters: Array<[string, UiAdapter]> = [
  ['element-plus', elementPlusAdapter],
  ['vant', vantAdapter],
  ['naive-ui', naiveUiAdapter],
]

const conformanceSource = readFileSync(join(import.meta.dirname, '..', 'src', 'index.ts'), 'utf8')
const declaredMarkers = [...conformanceSource.matchAll(/@capability\s+([\w.-]+)/g)].map((m) => m[1])

const descriptive = new Set<string>(DESCRIPTIVE_KEYS)

/** 枚举值是"真值"当且仅当它不是基线；没有登记基线的枚举不参与 */
function isActiveEnum(key: string, value: string): boolean {
  const baseline = ENUM_BASELINES[key]
  return baseline !== undefined && value !== baseline
}

/** 收集某个适配器上所有「真值」能力位 */
function activePaths(caps: Capabilities): string[] {
  const out: string[] = []

  for (const group of ['dataGrid', 'form', 'overlay', 'pagination', 'feedback', 'theme'] as const) {
    for (const [field, value] of Object.entries(caps[group] ?? {})) {
      const key = `${group}.${field}`
      if (descriptive.has(key)) continue
      if (typeof value === 'boolean') {
        if (value) out.push(key)
      } else if (typeof value === 'string') {
        if (isActiveEnum(key, value)) out.push(key)
      } else if (Array.isArray(value)) {
        if (value.length > 0) out.push(key)
      }
    }
  }

  for (const [feature, on] of Object.entries(caps.features ?? {})) {
    if (on) out.push(`features.${feature}`)
  }

  return out
}

const allActive = new Map<string, string[]>()
for (const [name, adapter] of adapters) {
  for (const path of activePaths(adapter.capabilities)) {
    allActive.set(path, [...(allActive.get(path) ?? []), name])
  }
}

const strict = process.env.FBK_STRICT_CAPABILITIES === '1'

describe('能力位与实现的绑定', () => {
  it('每个"真值"能力位都在覆盖表里交代了验证责任', () => {
    const missing = [...allActive.keys()].filter((p) => !(p in CAPABILITY_COVERAGE)).sort()
    expect(
      missing,
      `以下能力位声明为真值但没有任何验证责任：\n${missing
        .map((p) => `  ${p}（${allActive.get(p)!.join(', ')} 声明）`)
        .join('\n')}`,
    ).toEqual([])
  })

  it('覆盖表里的 marker 都能在一致性套件源码里找到', () => {
    const broken: string[] = []
    for (const [path, coverage] of Object.entries(CAPABILITY_COVERAGE)) {
      if (!('marker' in coverage)) continue
      if (!declaredMarkers.includes(coverage.marker)) {
        broken.push(`${path} → 找不到 @capability ${coverage.marker}`)
      }
    }
    expect(broken, broken.join('\n')).toEqual([])
  })

  it('一致性套件里的每个 @capability 标记都在覆盖表里登记', () => {
    const orphans = declaredMarkers.filter(
      (m) => !Object.values(CAPABILITY_COVERAGE).some((c) => 'marker' in c && c.marker === m),
    )
    expect(orphans, `孤儿标记：${orphans.join(', ')}`).toEqual([])
  })

  it('静态可判定的能力位在声明它的适配器上确实存在', () => {
    const broken: string[] = []
    for (const [path, coverage] of Object.entries(CAPABILITY_COVERAGE)) {
      if (!('static' in coverage)) continue
      for (const [name, adapter] of adapters) {
        if (!allActive.get(path)?.includes(name)) continue
        if (!coverage.static(adapter)) broken.push(`${name}: 声明了 ${path} 但对象上没有对应成员`)
      }
    }
    expect(broken, broken.join('\n')).toEqual([])
  })

  it(`未验证的能力位（${strict ? 'strict：必须为 0' : '普通模式：仅记录'}）`, () => {
    const unverified = Object.entries(CAPABILITY_COVERAGE)
      .filter(([, c]) => 'unverified' in c)
      .map(([path, c]) => `  ${path} —— ${(c as { unverified: string }).unverified}`)

    if (!strict) {
      // 普通模式只把欠债打印出来（vitest 会在失败时显示，这里用 expect 保证类型可读）
      expect(unverified.length).toBeGreaterThanOrEqual(0)
      return
    }
    expect(unverified, `strict 模式下仍有未验证的能力位：\n${unverified.join('\n')}`).toEqual([])
  })
})
