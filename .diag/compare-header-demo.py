"""二次确认：header 上的控件 vs demo 里的控件，样式是否真的一致。

上一轮分别改了这两处，但没有直接对比过。这里把两者的计算样式
逐项拉出来对照。
"""

import json

from playwright.sync_api import sync_playwright

URL = "http://localhost:5179/"

PROPS = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "height",
    "padding",
    "borderRadius",
    "borderWidth",
    "borderColor",
    "backgroundColor",
    "color",
    "lineHeight",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(URL)
    page.wait_for_load_state("networkidle")

    # 切到有按钮的 demo
    sels = page.locator(".playground__field select")
    sels.nth(2).select_option("result/basic")
    page.wait_for_timeout(1500)

    result = page.evaluate(
        """
        (props) => {
          const grab = (el, label) => {
            if (!el) return { label, error: 'not found' };
            const cs = getComputedStyle(el);
            const out = { label };
            for (const k of props) out[k] = cs[k];
            out._rect = Math.round(el.getBoundingClientRect().height);
            return out;
          };

          return {
            headerSelect: grab(document.querySelector('.playground__field select'), 'header <select>'),
            headerButton: grab(document.querySelector('.playground__toggle'), 'header <button>'),
            demoButton: grab(document.querySelector('.fbk-demo-btn'), 'demo .fbk-demo-btn'),
            demoPrimary: grab(document.querySelector('.fbk-demo-btn--primary'), 'demo .fbk-demo-btn--primary'),
            // 业务组件自己的按钮，作为"应有的样子"的基准
            bizButton: grab(document.querySelector('.el-button, .n-button'), 'biz button'),
          };
        }
        """,
        PROPS,
    )

    browser.close()

print(json.dumps(result, ensure_ascii=False, indent=2))

# 逐项对比 header 与 demo
print("\n" + "=" * 70)
print("对比：header 控件 vs demo 控件")
print("=" * 70)

hdr = result["headerButton"]
demo = result["demoButton"]
diffs = []
for k in PROPS:
    hv = hdr.get(k)
    dv = demo.get(k)
    if hv != dv:
        diffs.append((k, hv, dv))

if diffs:
    print("\n存在差异：")
    for k, hv, dv in diffs:
        print(f"  {k:16} header={hv!r:30} demo={dv!r}")
else:
    print("\n两者完全一致")

print("\n" + "=" * 70)
print("对比：header select vs demo button（都是普通控件，应尽量对齐）")
print("=" * 70)
hdr2 = result["headerSelect"]
diffs2 = []
for k in PROPS:
    hv = hdr2.get(k)
    dv = demo.get(k)
    if hv != dv:
        diffs2.append((k, hv, dv))
for k, hv, dv in diffs2:
    print(f"  {k:16} select={hv!r:30} demo={dv!r}")
