import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'

/**
 * 开发期 prop 校验的配套门禁：**公开契约里的每个字段，要么被读取，要么被登记为「当前无效」**。
 *
 * ## 为什么需要它
 *
 * `devWarnUnknownProps` 只能在用户传错时提醒。真正要挡住的是另一件事：
 * 我们在 types.ts 里**声明了一个没有人读取的字段** —— 类型看起来支持，实现里一次没读过，
 * 用户传了它就静默失效。一次评审里为此删掉过 12 个这样的字段（ROADMAP 判据 3）。
 * 靠人肉评审挡不住第 13 个，所以把它变成一道可判定的检查。
 *
 * ## 五条规则（都可判定，没有「是否规范」这种说法）
 *
 * 1. 扫描 `packages/components/src/<组>/types.ts` 的公开 prop 契约：`*Props` 接口，加上
 *    对象数组型 prop 的元素契约（`ProTableColumn` / `FormField` —— 用户把字段对象写在
 *    数组里，一样会「传了不生效」）。其余接口（`*Slots` / `*Expose` / `*Action`）不是
 *    prop 契约，扫了只会制造噪声。
 * 2. 每个字段必须在**同目录**的实现或模板里被读取。三个读法都认：
 *    `x.<字段>`（含 `x.字段.y`）、`x['<字段>']`、以及 `const { <字段> } = defineProps…`
 *    这种解构（Vue 3.5 的响应式 props 解构，此时字段名在脚本里是裸标识符）；
 *    `.vue` 模板里 props 也是裸标识符，所以模板区按裸名判定。
 * 3. 没有读取的字段，必须在 `packages/adapter-core/src/dev-warn.ts` 的
 *    `UNIMPLEMENTED_PROPS` 里登记一行「契约名.字段名 → 现在该写什么」。登记了就等于
 *    承诺「它确实无效，而且用户传了会收到一条可执行的提示」。
 * 4. `REMOVED_PROPS` 里登记为「已移除」的字段，不能再出现在类型里 ——
 *    否则那句「已移除」的提示是假的。
 * 5. 反过来：`UNIMPLEMENTED_PROPS` 里登记为「当前无效」的字段，不能已经被读取 ——
 *    否则提示同样在骗人（它已经实现了）。
 *
 * 另外核对两件「调用点自己的契约」：
 *
 * 6. 每个 devWarn* 调用点所在文件里，`import.meta.env` 必须出现在调用**之前** ——
 *    守卫被顺手删掉的话，生产包会开始打日志，而这在开发环境里永远看不出来。
 *    允许清单（`devWarnUnknownProps('X', …, KEYS)` 的 KEYS）必须覆盖契约的全部字段 ——
 *    少写一个，用户传合法 prop 会被误报成「未声明的 prop」。
 *
 * 已知边界（如实标注，不要靠脑补以为它更严）：读取判定看的是「属性访问 / 元素访问 /
 * props 解构 / 模板裸名」这四种语法，不做类型推断。它挡住的是「一个字段从头到尾没人提过」
 * 这种现实缺陷；刻意绕过（比如把局部变量起成同名字段）不在这道门禁的射程内。
 */

const root = resolve(import.meta.dirname, '..')
const componentsSrc = join(root, 'packages', 'components', 'src')
const devWarnFile = join(root, 'packages', 'adapter-core', 'src', 'dev-warn.ts')

/** 对象数组型 prop 的元素契约。新增这类契约时加进来，否则它不受第 2 条规则约束。 */
const NESTED_CONTRACTS = new Set(['ProTableColumn', 'FormField'])

/** 这些标识符的成员访问一律算「读 props」之外的普通读取 —— 名字就叫 props / attrs 的那几种 */
const PROPS_OWNERS = new Set(['props', 'attrs', 'this'])

const rel = (path) => relative(root, path).replace(/\\/g, '/')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** 一个 types.ts 里的公开 prop 契约：只取**自己声明的**成员（继承来的字段由基类所在目录负责） */
function contractsOf(file) {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const contracts = []
  for (const statement of sf.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue
    const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    const name = statement.name.text
    if (!name.endsWith('Props') && !NESTED_CONTRACTS.has(name)) continue
    const fields = []
    for (const member of statement.members) {
      if (!ts.isPropertySignature(member) || !member.name) continue
      if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) fields.push(member.name.text)
    }
    contracts.push({ name, fields })
  }
  return contracts
}

/**
 * 登记表就写在 dev-warn.ts 里（唯一真相）。按 AST 读，不用正则猜：
 * 正则版在「文案里带引号或逗号」时会静默漏行 —— 那正好会把登记判定变成假绿。
 */
function readRegistry() {
  const sf = ts.createSourceFile(devWarnFile, readFileSync(devWarnFile, 'utf8'), ts.ScriptTarget.Latest, true)
  const tables = {}
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const decl of statement.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
      if (!ts.isObjectLiteralExpression(decl.initializer)) continue
      const entries = new Map()
      for (const prop of decl.initializer.properties) {
        if (!ts.isPropertyAssignment(prop) || !prop.name) continue
        if (!ts.isStringLiteral(prop.name) || !ts.isStringLiteral(prop.initializer)) continue
        entries.set(prop.name.text, prop.initializer.text)
      }
      tables[decl.name.text] = entries
    }
  }
  if (!tables.REMOVED_PROPS || !tables.UNIMPLEMENTED_PROPS) {
    console.error('[dev-warn] ' + rel(devWarnFile) + ' 里找不到 REMOVED_PROPS / UNIMPLEMENTED_PROPS 两张登记表')
    process.exit(1)
  }
  return { removed: tables.REMOVED_PROPS, unimplemented: tables.UNIMPLEMENTED_PROPS }
}

/**
 * 去掉注释。必须是状态机而不是正则：注释里写着「`import.meta.env.DEV` 会被折成 false」
 * 这种话时，正则会把解释当成真守卫 —— 实测过，删掉守卫后门禁仍然全绿（假绿）。
 * 算法与 scripts/gen-api-snapshot.mjs 的同名函数一致（字符串里出现 `//` 不能算注释开头）。
 */
function stripComments(text) {
  let out = ''
  let i = 0
  let quote = null
  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (quote) {
      out += c
      if (c === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      i += 1
      continue
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** `.vue` 拆成脚本与模板：脚本按 TS 语法读，模板里的 props 是裸标识符 */
function splitSfc(text) {
  const end = text.lastIndexOf('</script>')
  if (end === -1) return { script: text, template: '' }
  return { script: text.slice(0, end), template: text.slice(end + '</script>'.length) }
}

/** 脚本里的读取：`x.foo` / `x['foo']` / `const { foo } = defineProps…` */
function collectReads(source, file, reads) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node)) reads.add(node.name.text)
    else if (ts.isElementAccessExpression(node) && node.argumentExpression) {
      const arg = node.argumentExpression
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) reads.add(arg.text)
    } else if (ts.isObjectBindingPattern(node)) {
      /* Vue 3.5 的响应式 props 解构：字段名在脚本里是裸标识符，没有 `props.` 前缀 */
      const init = node.parent && ts.isVariableDeclaration(node.parent) ? node.parent.initializer : undefined
      const fromProps =
        init &&
        ((ts.isCallExpression(init) && ts.isIdentifier(init.expression) &&
          ['defineProps', 'withDefaults'].includes(init.expression.text)) ||
          (ts.isIdentifier(init) && PROPS_OWNERS.has(init.text)))
      if (fromProps) {
        for (const element of node.elements) {
          if (element.name && ts.isIdentifier(element.name)) reads.add(element.name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

/** 同目录实现的读取信号：脚本里的访问集合 + 模板全文（模板按裸名判定） */
function readSignals(files) {
  const reads = new Set()
  let template = ''
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!file.endsWith('.vue')) {
      collectReads(text, file, reads)
      continue
    }
    const parts = splitSfc(text)
    collectReads(parts.script, file, reads)
    /* 属性名（:title= / v-if= / @click=）不是读取，先抹掉；只留表达式与裸标识符 */
    template += parts.template.replace(/<!--[\s\S]*?-->/g, '').replace(/[^\s=<>"']+=/g, '') + '\n'
  }
  return { reads, template }
}

function isRead(field, signals) {
  if (signals.reads.has(field)) return true
  const name = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  /* 模板里两种写法都算读：`field.help`（属性访问）与 `direction === 'vertical'`（裸名） */
  return new RegExp('(\\.\\s*|^|[^\\w$.])' + name + '\\b').test(signals.template)
}

const { removed, unimplemented } = readRegistry()
const problems = []

/** dir → { typeFile, contracts, signals }；两个反向规则要复用同一批信号，避免重复遍历 */
const groups = new Map()
for (const typeFile of walk(componentsSrc).filter((file) => file.endsWith('types.ts'))) {
  const dir = dirname(typeFile)
  const contracts = contractsOf(typeFile)
  if (contracts.length === 0) continue
  const siblings = walk(dir).filter((file) => file !== typeFile && /\.(ts|vue)$/.test(file))
  groups.set(dir, { typeFile, contracts, signals: readSignals(siblings) })
}

/* 规则 2 + 3：每个字段都要有读取，或者在 UNIMPLEMENTED_PROPS 里登记 */
let fieldCount = 0
for (const { typeFile, contracts, signals } of groups.values()) {
  for (const contract of contracts) {
    for (const field of contract.fields) {
      fieldCount += 1
      if (isRead(field, signals)) continue
      if (unimplemented.has(contract.name + '.' + field)) continue
      problems.push(
        rel(typeFile) + ' ' + contract.name + '.' + field +
          '：同目录的实现与模板里都没有读过它（传了不会生效，也没有任何提示）。\n' +
          '      删掉这个字段，或在 packages/adapter-core/src/dev-warn.ts 的 UNIMPLEMENTED_PROPS 登记一行说明。',
      )
    }
  }
}

/** 契约名 → [{ group, contract }]，给两个反向规则定位 */
function findContract(contractName) {
  const hits = []
  for (const group of groups.values()) {
    for (const contract of group.contracts) if (contract.name === contractName) hits.push({ group, contract })
  }
  return hits
}

/* 规则 4：登记为「已移除」的字段不能还在类型里 */
for (const key of removed.keys()) {
  const [contractName, field] = key.split('.')
  for (const { contract } of findContract(contractName)) {
    if (!contract.fields.includes(field)) continue
    problems.push(
      contractName + '.' + field + ' 在 REMOVED_PROPS 里登记为「已移除」，但类型里还有它 —— 那句提示与实际不符。',
    )
  }
}

/* 规则 5：登记为「当前无效」的字段不能已经被读取（登记过期） */
for (const key of unimplemented.keys()) {
  const [contractName, field] = key.split('.')
  for (const { group, contract } of findContract(contractName)) {
    if (!contract.fields.includes(field) || !isRead(field, group.signals)) continue
    problems.push(
      contractName + '.' + field + ' 登记为「当前无效」，但实现里已经在读它了 —— 提示会误导用户，删掉那一行登记。',
    )
  }
}

/* 允许清单：调用 devWarnUnknownProps('X', …, KEYS) 时，KEYS 必须覆盖 X 契约的全部字段 */
const callRe = /devWarnUnknownProps\(\s*['"](\w+)['"]\s*,\s*[^,]+?,\s*([^)]+?)\s*\)/g
let checkedLists = 0
for (const file of walk(componentsSrc).filter((f) => f.endsWith('.vue'))) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(callRe)) {
    const [, contractName, listArg] = match
    const listId = listArg.trim()
    /* 允许清单写成内联数组就无法与契约逐字段核对 —— 那等于这道规则没跑 */
    if (!/^\w+$/.test(listId)) {
      problems.push(
        rel(file) + ' 调用 devWarnUnknownProps(\'' + contractName + '\', …) 的允许清单不是具名的 as const 数组（' +
          listId + '），无法核对它是否覆盖了契约的全部字段。',
      )
      continue
    }
    const listMatch = new RegExp('const\\s+' + listId + '\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const').exec(text)
    if (!listMatch) {
      problems.push(rel(file) + ' 调用 devWarnUnknownProps(\'' + contractName + '\', …) 但找不到允许清单 ' + listId + ' 的 as const 数组')
      continue
    }
    const listed = new Set([...listMatch[1].matchAll(/['"]([\w$.-]+)['"]/g)].map((m) => m[1]))
    const group = groups.get(dirname(file))
    const contract = group && group.contracts.find((c) => c.name === contractName + 'Props' || c.name === contractName)
    if (!contract) {
      problems.push(rel(file) + ' 的允许清单 ' + listId + ' 找不到对应的契约接口（' + contractName + 'Props / ' + contractName + '）')
      continue
    }
    checkedLists += 1
    for (const field of contract.fields) {
      if (listed.has(field)) continue
      problems.push(
        rel(file) + ' 的允许清单 ' + listId + ' 少了 ' + contract.name + '.' + field +
          ' —— 用户传这个合法字段会被误报成「未声明的 prop」。',
      )
    }
  }
}

/* 规则 6：每个调用点都必须待在 import.meta.env 守卫里 —— 删掉守卫，生产包里会真的打日志。
   判定是静态的（守卫出现在调用之前），够挡住「顺手删掉」这一类改动，不是数据流分析。 */
const GUARD_RE = /import\.meta[\s\S]{0,60}?\.env/
const DEV_CALL_RE = /devWarn(?:UnknownProps|RemovedProps|Unimplemented)\(/g
let guardedSites = 0
for (const file of walk(componentsSrc).filter((f) => /\.(ts|vue)$/.test(f))) {
  const text = stripComments(readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, ''))
  const calls = [...text.matchAll(DEV_CALL_RE)]
  if (calls.length === 0) continue
  const guard = GUARD_RE.exec(text)
  if (!guard) {
    problems.push(
      rel(file) + ' 调用了开发期校验，但文件里没有 import.meta.env 守卫 —— 生产包里会真的打日志。',
    )
    continue
  }
  if (guard.index > calls[0].index) {
    problems.push(
      rel(file) + ' 的 import.meta.env 守卫出现在第一次 devWarn* 调用之后 —— 守卫必须包住调用点。',
    )
    continue
  }
  guardedSites += 1
}

/* 一个契约都没扫到 = 路径算错了，这道门等于没跑（与 check-syntax 同一条纪律） */
if (groups.size === 0 || fieldCount === 0) {
  console.error('[dev-warn] 一个 prop 契约都没扫到 —— 路径算错了，这道门禁等于没跑')
  process.exit(1)
}

if (problems.length > 0) {
  console.error('[dev-warn] 发现 ' + problems.length + ' 处问题：')
  for (const problem of problems) console.error('  · ' + problem)
  process.exit(1)
}

const contractCount = [...groups.values()].reduce((n, g) => n + g.contracts.length, 0)
console.log(
  '[dev-warn] OK：' + groups.size + ' 个组件目录 / ' + contractCount + ' 个 prop 契约 / ' + fieldCount +
    ' 个字段，全部有读取或已登记未实现（登记 ' + unimplemented.size + ' 条「当前无效」、' + removed.size +
    ' 条「已移除」；' + checkedLists + ' 份允许清单与契约一致，' + guardedSites + ' 个调用点在 DEV 守卫内）',
)
