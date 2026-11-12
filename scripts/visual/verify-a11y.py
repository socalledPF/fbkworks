"""无障碍（a11y）门禁：用 axe-core 在**真实浏览器**里扫页面，按基线只拦「新增违规」。

为什么必须在真实浏览器：缺可访问名、标题层级跳级、表单 label 未关联 —— 这些只有渲染完的
DOM 才看得出来，jsdom 里没有布局也没有焦点。

为什么风险面在「我们的组合层」而不是原语层：39 个原语实现里只有 2 个自己写了 role/aria，
语义主要由 element-plus / vant / naive-ui 提供，我们只做转发（实测 37/39 透传 rest props）。
真正由我们写出语义的是组合层：ProTable 的工具条/批量条/排序表头、CrudPage 与 DetailPage
的标题结构、FormModal 与 DetailDrawer 的弹层语义、Screen 的图表替代表述。

判据不自造：用 axe 的 WCAG 2.0/2.1 A/AA 规则集，只把 `serious` 与 `critical` 计入门禁
（`moderate`/`minor` 只进报告 —— 它们噪声大，拿来当门禁会被学会忽略）。

门禁形态是**棘轮**：现状记在 `a11y-baseline.json`，只有「新出现的规则」或「同一页同一规则
条数变多」才失败。修好一条就跑 `--update-baseline` 把基线降下来 —— 那个文件的 diff 就是还债记录。

用法（需先起服务）：
    pnpm playground & pnpm admin
    python scripts/visual/verify-a11y.py                    # 门禁：与基线比对
    python scripts/visual/verify-a11y.py --report           # 只出报告（写 a11y-report.json）
    python scripts/visual/verify-a11y.py --update-baseline  # 重写基线

退出码非 0 表示有新增违规，或某个页面根本没扫到（静默扫空等于没检查）。
"""

import json
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

# Windows 控制台默认 GBK，print("✓") 会 UnicodeEncodeError（verify-admin 实测崩过）。
import sys as _sys_utf8

if hasattr(_sys_utf8.stdout, "reconfigure"):
    _sys_utf8.stdout.reconfigure(encoding="utf-8", errors="replace")


ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / "a11y-baseline.json"
REPORT = ROOT / "a11y-report.json"
AXE = ROOT / "node_modules" / "axe-core" / "axe.min.js"

# 端口由调用方给：应用没有 strictPort，vite 在端口被占时会静默换端口，
# 写死端口就可能评的是上一次残留的实例（CI 里由 scripts/visual/start-service.sh
# 从启动日志里取真实端口再传进来）。
# 端口来源优先级：环境变量 > 命令行参数 > 默认值。
# 走环境变量是因为 CI 里通过 `pnpm check:a11y` 调用 —— pnpm 对「脚本名后面跟参数」
# 的转发规则与 npm 不同，传参容易在本地与 CI 之间出现两种行为。
PLAYGROUND_PORT = os.environ.get("FBK_PLAYGROUND_PORT") or (sys.argv[1] if len(sys.argv) > 1 else "5174")
ADMIN_PORT = os.environ.get("FBK_ADMIN_PORT") or (sys.argv[2] if len(sys.argv) > 2 else "5185")
GATED_IMPACTS = {"serious", "critical"}

DEMOS = [
    "pro-table/basic", "pro-table/with-query", "pro-table/selection",
    "query-form/basic", "form-generator/basic", "page-container/basic",
    "crud-page/basic", "form-modal/basic", "result/basic",
    "detail-page/basic", "detail-drawer/basic", "descriptions/basic",
    "dashboard/basic", "screen/basic", "feedback/basic",
]
ADAPTERS = ["element-plus", "naive-ui", "vant"]
ADMIN_ROUTES = ["/", "/orders", "/orders/1", "/users", "/settings", "/403", "/404"]

AXE_RUN = """async (contextSelector) => {
  const ctx = document.querySelector(contextSelector) || document
  const r = await axe.run(ctx, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return r.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    count: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }))
}"""


# 只扫**内容区**，不扫 playground / admin 自己的应用外壳（侧边栏、顶栏）。
# 外壳是这两个 demo 应用的基础设施，不是这个库的一部分；实测把它算进来时 color-contrast
# 有 532 处，几乎全来自 playground 侧边栏的分组标题，会把真正要盯的信号淹掉。
PLAYGROUND_CONTEXT = ".pg__main"
ADMIN_CONTEXT = ".admin-content"


def scan(page, label, result, context):
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1200)
    if not AXE.exists():
        print(f"[a11y] 找不到 {AXE}，先执行 pnpm install")
        sys.exit(2)
    # 上下文必须真的存在：以前是「找不到就退回整页扫」，那会让一个渲染失败的页面
    # 看起来扫过了（只是扫到了别的东西）。
    rendered = page.evaluate(
        """(sel) => {
          const el = document.querySelector(sel)
          if (!el) return { ok: false, reason: '找不到容器 ' + sel }
          const text = (el.innerText || '').trim()
          return { ok: text.length > 0 || el.querySelector('canvas, svg, img, input') !== null, reason: '容器里没有任何内容' }
        }""",
        context,
    )
    if not rendered["ok"]:
        print(f"✗ [{label}] 页面没渲染出内容（{rendered['reason']}）")
        sys.exit(1)

    page.add_script_tag(path=str(AXE))
    violations = page.evaluate(AXE_RUN, context)
    # axe 永远返回数组；这里守的是「拿不到结果」而不是「没问题」
    if violations is None:
        print(f"✗ [{label}] axe 没返回结果")
        sys.exit(1)
    result[label] = violations


def main() -> int:
    args = sys.argv[1:]
    mode = "check"
    if "--update-baseline" in args:
        mode = "update"
    elif "--report" in args:
        mode = "report"

    findings = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ---- playground：15 个 demo × 3 个适配器 ----
        pg = browser.new_page(viewport={"width": 1440, "height": 1000})
        for adapter in ADAPTERS:
            for demo in DEMOS:
                pg.goto(f"http://localhost:{PLAYGROUND_PORT}/#/{demo}?adapter={adapter}&theme=light")
                scan(pg, f"playground[{adapter}]:{demo}", findings, PLAYGROUND_CONTEXT)

        # ---- admin：7 个页面（先登录）----
        ad = browser.new_page(viewport={"width": 1440, "height": 900})
        ad.goto(f"http://localhost:{ADMIN_PORT}/")
        ad.wait_for_timeout(2000)
        ad.locator(".login__submit").click()
        ad.wait_for_timeout(2500)
        for route in ADMIN_ROUTES:
            ad.evaluate("(r) => { location.hash = r }", route)
            ad.wait_for_timeout(1200)
            scan(ad, f"admin:{route}", findings, ADMIN_CONTEXT)
        browser.close()

    total_pages = len(findings)
    empty = [k for k, v in findings.items() if v is None]
    if empty:
        print(f"✗ 有 {len(empty)} 个页面没扫到：{empty[:3]}")
        return 1

    gated = {}
    for page_label, violations in findings.items():
        rules = {}
        for v in violations:
            if v["impact"] in GATED_IMPACTS:
                rules[v["id"]] = v["count"]
        if rules:
            gated[page_label] = rules

    if mode == "report":
        REPORT.write_text(
            json.dumps({"pages": total_pages, "findings": findings}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"扫描 {total_pages} 个页面，报告写入 {REPORT.name}\n")
        by_rule = {}
        for violations in findings.values():
            for v in violations:
                key = (v["impact"], v["id"])
                by_rule[key] = by_rule.get(key, 0) + v["count"]
        for (impact, rule), n in sorted(by_rule.items(), key=lambda kv: -kv[1]):
            mark = "门禁" if impact in GATED_IMPACTS else "  · "
            print(f"  {mark} {impact:9} {rule:34} {n} 处")
        print(f"\n计入门禁（serious/critical）的页面数：{len(gated)}/{total_pages}")
        return 0

    if mode == "update":
        payload = {
            "_note": "由 scripts/visual/verify-a11y.py --update-baseline 生成。只含 serious/critical。"
                     "修好一条就重跑一次，让这份文件的 diff 成为还债记录。",
            "pages": gated,
        }
        BASELINE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        total = sum(sum(r.values()) for r in gated.values())
        print(f"基线已写入 {BASELINE.name}：{len(gated)} 个页面 / {total} 处 serious+critical")
        return 0

    if not BASELINE.exists():
        print("[a11y] 缺少 a11y-baseline.json，先跑 --update-baseline")
        return 1
    baseline = json.loads(BASELINE.read_text(encoding="utf-8")).get("pages", {})

    failures = []
    for page_label, rules in gated.items():
        known = baseline.get(page_label, {})
        for rule, count in rules.items():
            if rule not in known:
                failures.append(f"  + [{page_label}] {rule} ×{count}（基线里没有这条）")
            elif count > known[rule]:
                failures.append(f"  ↑ [{page_label}] {rule} {known[rule]} → {count} 处")
    # 一整页从「有违规」变成「零违规」有两种可能：真的修好了，或者这一页根本没渲染。
    # 后者会把「覆盖面丢了」伪装成「还债了」，所以必须要求人显式确认（--update-baseline）。
    vanished = [p for p in baseline if p not in gated]
    if vanished:
        print(f"✗ 有 {len(vanished)} 个页面这次一处 serious/critical 都没有（基线里原本有）：")
        for p in vanished[:8]:
            print(f"  ? [{p}]")
        print("  要么真的修好了，要么这一页没渲染。确认无遗漏后跑 --update-baseline 把基线降下来。")
        return 1

    improved = [
        f"  ↓ [{p}] {r} {c} → {gated.get(p, {}).get(r, 0)} 处"
        for p, rules in baseline.items()
        for r, c in rules.items()
        if gated.get(p, {}).get(r, 0) < c
    ]

    if improved:
        print("比基线好了（跑 --update-baseline 把它记下来）：")
        print("\n".join(improved))
        print()

    if failures:
        print(f"✗ 新增 {len(failures)} 处无障碍违规（serious/critical）：")
        print("\n".join(failures))
        print("\n修掉，或确认可接受后跑 --update-baseline（那会在 diff 里留下记录）。")
        return 1

    total = sum(sum(r.values()) for r in gated.values())
    print(f"[a11y] OK：{total_pages} 个页面，serious/critical 未超出基线（现有 {total} 处，{len(baseline)} 个页面）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
