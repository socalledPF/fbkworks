"""表单能力位的真实浏览器验证。

# @capability form.labelWidth
# @capability form.validateOn
# @capability form.asyncValidator

这三条在 jsdom 里测不出来，因此不在一致性套件里，而是由本脚本在真实浏览器中覆盖。

为什么必须用浏览器：
  · labelWidth     需要测量标签的真实宽度，jsdom 没有布局引擎
  · validateOn     jsdom 下 element-plus 的 validate() 直接返回 true
  · asyncValidator 依赖异步校验器真正结算

被驱动的页面是 apps/playground/probe.html（独立入口，不进 demo 注册表）。
能力声明为 false 的项会 SKIP —— 不承诺的事不该被要求做到。

用法（需先启动 playground）：
    pnpm playground
    python scripts/visual/verify-form-capabilities.py [端口]

非 0 退出码表示失败。

已知失败（2026-10-28 首次运行，尚未修复）
----------------------------------------
能力位                 element-plus   naive-ui      vant
form.labelWidth        PASS 120/120   FAIL 98/108   声明 false，SKIP
form.validateOn(blur)  FAIL           PASS          FAIL
form.asyncValidator    PASS           FAIL          FAIL

这是「能力声明与实现不符」，不是脚本问题。

其中 element-plus 的 validateOn 值得单独查：同一次运行里它的 asyncValidator
能正确报错（说明 validator 映射是通的），但 required 规则在 blur 后得到的是
is-success —— 校验跑了却判定通过。「async 生效、required 不生效」这个组合
更像映射缺陷而不是 EP 的限制，应先定位再决定是修还是降级。
"""

import json
import sys

from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "5174"
BASE = f"http://localhost:{PORT}/probe.html"
ADAPTERS = ["element-plus", "naive-ui", "vant"]
EXPECTED_LABEL_WIDTH = 120
TOLERANCE = 1.5

ok = True


def check(name, passed, detail=""):
    global ok
    if not passed:
        ok = False
    print(f"  {'PASS' if passed else 'FAIL'}  {name}{('  ' + detail) if detail else ''}")


def label_width(page, text):
    return page.evaluate(
        """(text) => {
          const root = document.querySelector('[data-fbk-probe]')
          if (!root) return null
          const leaf = [...root.querySelectorAll('*')].filter(
            (n) => n.children.length === 0 && (n.textContent || '').trim() === text,
          )
          return leaf.length ? leaf[0].getBoundingClientRect().width : null
        }""",
        text,
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    for adapter in ADAPTERS:
        print(f"\n[{adapter}]")
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.goto(f"{BASE}?adapter={adapter}", wait_until="networkidle")
        page.wait_for_timeout(600)

        caps = json.loads(page.get_attribute("[data-fbk-probe]", "data-capabilities"))

        if caps["form"]["labelWidth"]:
            short_w = label_width(page, "短")
            long_w = label_width(page, "很长的标签")
            if short_w is None or long_w is None:
                check("form.labelWidth 标签可测量", False, f"short={short_w} long={long_w}")
            else:
                same = abs(short_w - long_w) <= TOLERANCE
                near = abs(short_w - EXPECTED_LABEL_WIDTH) <= TOLERANCE
                check(
                    "form.labelWidth 两标签等宽且等于传入值",
                    same and near,
                    f"短={short_w:.1f}px 长={long_w:.1f}px 期望~{EXPECTED_LABEL_WIDTH}",
                )
        else:
            print("  SKIP  form.labelWidth（适配器声明 false）")

        if "blur" in caps["form"]["validateOn"]:
            page.locator('[data-probe-field="short"] input').first.click()
            page.keyboard.press("Tab")
            page.wait_for_timeout(600)
            shown = page.evaluate("() => document.body.innerText.includes('PROBE_REQUIRED_SHORT')")
            check("form.validateOn blur 触发必填校验", shown)
        else:
            print("  SKIP  form.validateOn（未声明 blur）")

        if caps["form"]["asyncValidator"]:
            page.locator('[data-probe-field="async"] input').first.fill("bad")
            page.keyboard.press("Tab")
            page.wait_for_timeout(800)
            shown = page.evaluate("() => document.body.innerText.includes('PROBE_ASYNC_ASYNC')")
            check("form.asyncValidator 异步校验结果生效", shown)
        else:
            print("  SKIP  form.asyncValidator（适配器声明 false）")

        page.close()
    browser.close()

print()
print("表单能力位验证全部通过" if ok else "表单能力位验证失败")
sys.exit(0 if ok else 1)
