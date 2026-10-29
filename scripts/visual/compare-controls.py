"""全量对比：Playground header 控件 vs 所有 demo 里的 .fbk-demo-btn。

为什么需要这个脚本：header 与 demo 的按钮样式分别定义在
playground.css 与 @fbkworks/demos/style.css 两个文件里，很容易改了一处漏了另一处。
而且组件样式可能以更高特异性压过业务方的类（实测发生过：
ProTable 的 `.fbk-pro-table__bulk button` 压掉了 .fbk-demo-btn）。

用法（需先启动 playground）：
    pnpm playground
    python scripts/visual/compare-controls.py [端口]

退出码非 0 表示存在不一致。
"""

import json

from playwright.sync_api import sync_playwright

import sys

PORT = sys.argv[1] if len(sys.argv) > 1 else "5179"
URL = f"http://localhost:{PORT}/"
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
    "backgroundImage",
    "appearance",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto(URL)
    page.wait_for_load_state("networkidle")

    # header 基准：button 与 select 分别采集。
    # select 有两处必要的自身差异（右侧箭头留位、自绘箭头、去掉原生外观），
    # 其余属性必须与 demo 按钮一致。
    baseline = page.evaluate(
        """(props) => {
          const grab = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const cs = getComputedStyle(el);
            const out = {};
            for (const k of props) out[k] = cs[k];
            return out;
          };
          return { button: grab('.playground__toggle'), select: grab('.playground__field select') };
        }""",
        PROPS,
    )
    baseBtn = baseline["button"]
    baseSel = baseline["select"]

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

print(f"header button: {json.dumps(baseBtn, ensure_ascii=False)}")
print(f"header select: {json.dumps(baseSel, ensure_ascii=False)}")
print(f"\n扫描到 {len(findings)} 个 .fbk-demo-btn\n")

# 合法差异：
#   · 禁用态：文字色是 text-disabled
#   · primary / active 变体：底色与文字色按变体定义
DISABLED_COLOR = "rgb(168, 171, 178)"
VARIANT_ONLY = {"borderColor", "backgroundColor", "color"}

bad = []
for f in findings:
    diffs = {k: (baseBtn[k], f[k]) for k in PROPS if baseBtn[k] != f[k]}
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

# select 与 demo 按钮的对比。SELECT_ONLY 是 select 作为下拉框的必要差异。
SELECT_ONLY = {"padding", "backgroundImage", "appearance"}
sel_diffs = {k: (baseSel[k], baseBtn[k]) for k in PROPS if baseSel[k] != baseBtn[k]}
sel_bad = {k: v for k, v in sel_diffs.items() if k not in SELECT_ONLY}

print("\n" + "=" * 70)
print("header select vs header button（demo 按钮与之同规格）")
print("=" * 70)
if sel_bad:
    print("存在非必要差异：")
    for k, (a, b) in sel_bad.items():
        print(f"  ✗ {k:16} select={a!r:30} button={b!r}")
    bad.append({"demo": "(header)", "text": "select", "diffs": sel_bad})
else:
    print("除 select 必需的 3 项（箭头留位/自绘箭头/去原生外观）外完全一致")
    for k, (a, b) in sel_diffs.items():
        print(f"  · {k:16} select={str(a)[:36]:38} button={str(b)[:36]}")

if not bad:
    print("\n所有 .fbk-demo-btn 与 header 控件完全一致")
    sys.exit(0)
else:
    print(f"存在差异的按钮：{len(bad)}")
    for b in bad:
        print(f"  [{b['demo']}] \"{b['text']}\"")
        for k, (hv, dv) in b["diffs"].items():
            print(f"      {k:14} header={hv!r:26} demo={dv!r}")
    sys.exit(1)
