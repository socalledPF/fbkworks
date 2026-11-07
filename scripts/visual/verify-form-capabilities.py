"""表单能力位的真实浏览器验证。

# @capability form.labelWidth
# @capability form.validateOn
# @capability form.asyncValidator
# @capability pagination.mode

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

## 当前结果（2026-10-28）

能力位                 element-plus   naive-ui       vant
form.labelWidth        PASS           PASS           声明 false，SKIP
form.validateOn(blur)  PASS           PASS           FAIL
form.asyncValidator    PASS           FAIL           FAIL

element-plus 早先三项全红，根因是 FormItem 的 required 被 Vue 强转成 false，
覆盖掉了规则里的 required（已修，见 commit c0b551c）。

## 量标签宽度的坑（已踩过两次）

不能量「文字叶子节点」：naive 把宽度设在 .n-form-item-label 容器上，
叶子是里面的 __text，量出来是文字自然宽度（98/108 那种假数据）。
也不能靠「向上找仍是该文本的最外层元素」：EP 的 .el-form-item 文本内容
恰好也只有标签文字（input 不产生文本节点），会一路走到 1280；
naive 的必填星号又让容器文本不等于标签文本。
最终改为按库声明 label 选择器 —— 与一致性套件处理 per-adapter 选择器的方式一致。
"""

import json
import sys

from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "5174"
BASE = f"http://localhost:{PORT}/probe.html"
ADAPTERS = ["element-plus", "naive-ui", "vant"]

# 各库 label 元素的选择器：宽度就设在它身上
LABEL_SELECTOR = {
    "element-plus": ".el-form-item__label",
    "naive-ui": ".n-form-item-label",
}

EXPECTED_LABEL_WIDTH = 120
TOLERANCE = 1.5

ok = True


def check(name, passed, detail=""):
    global ok
    if not passed:
        ok = False
    print(f"  {'PASS' if passed else 'FAIL'}  {name}{('  ' + detail) if detail else ''}")


def label_width(page, adapter, field):
    selector = LABEL_SELECTOR.get(adapter)
    if not selector:
        return None
    return page.evaluate(
        """([field, selector]) => {
          const el = document.querySelector('[data-probe-field="' + field + '"] ' + selector)
          return el ? el.getBoundingClientRect().width : null
        }""",
        [field, selector],
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
            short_w = label_width(page, adapter, "short")
            long_w = label_width(page, adapter, "long")
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

        # ---- pagination.mode（只有声明 infinite 的适配器需要验）----
        if caps["pagination"]["mode"] == "infinite":
            scroll_page = browser.new_page(viewport={"width": 1280, "height": 900})
            scroll_page.goto(f"{BASE}?adapter={adapter}&scroll=1", wait_until="networkidle")
            scroll_page.wait_for_timeout(700)
            # 真实浏览器里滚动是真的：连续滚到底，给 van-list 的触底检查留时间
            for _ in range(3):
                scroll_page.evaluate(
                    """() => {
                      const el = document.querySelector('[data-probe-scroll]')
                      if (el) el.scrollTop = el.scrollHeight
                    }"""
                )
                scroll_page.wait_for_timeout(400)
            loads = scroll_page.evaluate(
                "() => Number(document.querySelector('[data-probe-load-count]')"
                "?.getAttribute('data-probe-load-count') ?? '0')"
            )
            check("pagination.mode 触底触发 load-more", loads > 0, f"loads={loads}")
            scroll_page.close()
        else:
            print("  SKIP  pagination.mode（适配器不是 infinite）")

        page.close()
    browser.close()

print()
print("表单能力位验证全部通过" if ok else "表单能力位验证失败")
sys.exit(0 if ok else 1)
