"""全量对比：header 控件 vs 所有 demo 里的 .fbk-demo-btn。

单个 demo 一致不代表全部一致 —— 有些 demo 可能用内联 style 覆盖了样式。
"""

import json

from playwright.sync_api import sync_playwright

URL = "http://localhost:5179/"
DEMOS = [
    "pro-table/basic",
    "pro-table/with-query",
    "pro-table/selection",
    "query-form/basic",
    "form-generator/basic",
    "page-container/basic",
    "crud-page/basic",
    "form-modal/basic",
    "result/basic",
    "descriptions/basic",
    "feedback/basic",
]

PROPS = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "height",
    "padding",
    "borderRadius",
    "borderWidth",
    "borderColor",
    "backgroundColor",
    "color",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto(URL)
    page.wait_for_load_state("networkidle")

    # header 基准
    baseline = page.evaluate(
        """(props) => {
          const el = document.querySelector('.playground__toggle');
          const cs = getComputedStyle(el);
          const out = {};
          for (const k of props) out[k] = cs[k];
          return out;
        }""",
        PROPS,
    )

    sels = page.locator(".playground__field select")
    findings = []
    for demo in DEMOS:
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        sels.nth(2).select_option(demo)
        page.wait_for_timeout(1300)

        btns = page.evaluate(
            """(props) => {
              return [...document.querySelectorAll('.fbk-demo-btn')].map((el) => {
                const cs = getComputedStyle(el);
                const out = { text: el.textContent.trim().slice(0, 12) };
                for (const k of props) out[k] = cs[k];
                return out;
              });
            }""",
            PROPS,
        )
        for b in btns:
            findings.append({"demo": demo, **b})

    browser.close()

print(f"header 基准: {json.dumps(baseline, ensure_ascii=False)}")
print(f"\n扫描到 {len(findings)} 个 .fbk-demo-btn\n")

# 合法差异：
#   · 禁用态：文字色是 text-disabled
#   · primary / active 变体：底色与文字色按变体定义
DISABLED_COLOR = "rgb(168, 171, 178)"
VARIANT_ONLY = {"borderColor", "backgroundColor", "color"}

bad = []
for f in findings:
    diffs = {k: (baseline[k], f[k]) for k in PROPS if baseline[k] != f[k]}
    if not diffs:
        continue

    # 禁用态：只允许 color 不同，且值必须是禁用色
    if set(diffs) == {"color"} and f["color"] == DISABLED_COLOR:
        continue

    # 变体按钮：颜色类属性可以不同，但字号/高度/圆角/内边距/字体必须一致
    non_color = {k: v for k, v in diffs.items() if k not in VARIANT_ONLY}
    if not non_color:
        continue

    bad.append({**f, "diffs": non_color})

if not bad:
    print("所有 .fbk-demo-btn 与 header 控件完全一致")
else:
    print(f"存在差异的按钮：{len(bad)}")
    for b in bad:
        print(f"  [{b['demo']}] \"{b['text']}\"")
        for k, (hv, dv) in b["diffs"].items():
            print(f"      {k:14} header={hv!r:26} demo={dv!r}")
