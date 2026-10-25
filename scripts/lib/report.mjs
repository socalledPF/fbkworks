/**
 * 影响报告的三种输出格式。
 *
 * 终端给人看（本地开发），Markdown 给 PR 评论，JSON 给其他工具。
 */

const LEVEL_LABEL = {
  changed: '改动本身',
  direct: '直接影响',
  indirect: '间接影响',
  transitive: '深层影响',
}

/* ---------- 终端 ---------- */

export function formatConsole({ changedFiles, globals, summary, checks }) {
  const lines = []
  lines.push('')
  lines.push('变更影响分析')
  lines.push('─'.repeat(50))

  if (globals.length > 0) {
    lines.push(`配置变更（${globals.length}）：${globals.join(', ')}`)
    lines.push('  → 视为全量影响，建议完整跑一次 verify')
    lines.push('')
  }

  lines.push(`改动 ${changedFiles.length} 个文件`)
  lines.push('')

  for (const level of ['direct', 'indirect', 'transitive']) {
    const items = summary.byLevel[level]
    if (items.length === 0) continue
    lines.push(`${LEVEL_LABEL[level]}（${items.length}）`)

    // 终端只列前 10 条，避免刷屏
    for (const item of items.slice(0, 10)) {
      lines.push(`  ${item.file}`)
    }
    if (items.length > 10) lines.push(`  … 另有 ${items.length - 10} 个`)
    lines.push('')
  }

  /* 整包受影响：跨包依赖的传播结果。
     单独列而不是拆成文件 —— 否则清单里全是某个包的 .vue，
     读者看不到「要不要重测这个包」这个真正的判断。 */
  if (summary.affectedPackages?.length > 0) {
    lines.push(`整包受影响（${summary.affectedPackages.length}）`)
    for (const pkg of summary.affectedPackages) {
      lines.push(`  ${pkg}`)
    }
    lines.push('  这些包依赖了改动的包，建议一并重测')
    lines.push('')
  }

  if (summary.apps.length > 0) {
    lines.push(`受影响的应用（${summary.apps.length}）`)
    for (const app of summary.apps) {
      lines.push(`  ${app.name}  (${app.files.length} 个文件)`)
    }
    lines.push('')
  }

  if (checks.length > 0) {
    lines.push('建议验证')
    for (const c of checks) lines.push(`  ${c}`)
    lines.push('')
  }

  if (summary.total <= changedFiles.length) {
    lines.push('没有其他文件依赖这些改动。')
    lines.push('')
  }

  return lines.join('\n')
}

/* ---------- Markdown（PR 评论） ---------- */

export function formatMarkdown({ changedFiles, globals, summary, checks }) {
  const lines = []
  lines.push('## 变更影响分析')
  lines.push('')

  if (globals.length > 0) {
    lines.push(`> ⚠️ 包含配置变更：${globals.map((g) => `\`${g}\``).join(', ')}`)
    lines.push('> 视为全量影响，建议完整跑一次 `pnpm verify`。')
    lines.push('')
  }

  lines.push(`改动 **${changedFiles.length}** 个文件，影响 **${summary.total - changedFiles.length}** 个下游文件。`)
  lines.push('')

  // 汇总表：一眼看到影响面
  lines.push('| 等级 | 文件数 |')
  lines.push('|---|---|')
  for (const level of ['changed', 'direct', 'indirect', 'transitive']) {
    const n = summary.byLevel[level].length
    if (n === 0) continue
    lines.push(`| ${LEVEL_LABEL[level]} | ${n} |`)
  }
  lines.push('')

  if (summary.affectedPackages?.length > 0) {
    lines.push('### 整包受影响')
    lines.push('')
    lines.push(
      summary.affectedPackages.map((p) => `\`${p}\``).join(' · ') +
        ' — 依赖了改动的包，建议一并重测。',
    )
    lines.push('')
  }

  if (summary.apps.length > 0) {
    lines.push('### 受影响的应用')
    lines.push('')
    for (const app of summary.apps) {
      lines.push(`- **${app.name}** — ${app.files.length} 个文件`)
    }
    lines.push('')
  }

  if (checks.length > 0) {
    lines.push('### 建议验证')
    lines.push('')
    lines.push('```bash')
    for (const c of checks) lines.push(c)
    lines.push('```')
    lines.push('')
  }

  // 完整清单折叠，避免评论过长
  const detail = ['direct', 'indirect', 'transitive']
    .filter((l) => summary.byLevel[l].length > 0)
    .map((l) => {
      const rows = summary.byLevel[l].map((i) => `- \`${i.file}\``)
      return [`**${LEVEL_LABEL[l]}**`, '', ...rows, ''].join('\n')
    })
    .join('\n')

  if (detail) {
    lines.push('<details>')
    lines.push('<summary>完整清单</summary>')
    lines.push('')
    lines.push(detail)
    lines.push('</details>')
    lines.push('')
  }

  return lines.join('\n')
}

/* ---------- JSON ---------- */

export function formatJson({ changedFiles, globals, summary, checks }) {
  return JSON.stringify(
    {
      changedFiles,
      globals,
      impacts: {
        changed: summary.byLevel.changed.map((i) => i.file),
        direct: summary.byLevel.direct.map((i) => i.file),
        indirect: summary.byLevel.indirect.map((i) => i.file),
        transitive: summary.byLevel.transitive.map((i) => i.file),
      },
      apps: summary.apps.map((a) => ({ name: a.name, files: a.files })),
      packages: summary.packages,
      affectedPackages: summary.affectedPackages ?? [],
      suggestedChecks: checks,
    },
    null,
    2,
  )
}
