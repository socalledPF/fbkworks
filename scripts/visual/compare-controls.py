"""跨 demo 的 `.fbk-demo-btn` 一致性对比。

为什么需要它：demo 按钮的样式只有一份（`@fbkworks/demos/style.css`），但**组件样式可能以
更高特异性压过业务方的类** —— 实测发生过：ProTable 的 `.fbk-pro-table__bulk button`
压掉了 `.fbk-demo-btn`。这种问题只会出现在「用了那个组件的那一页」，所以必须在多个 demo
之间横向比，看同一页面对不对得上，而不是只看一页。

历史：它原来还比较「playground header 的原生控件 vs demo 按钮」。playground 改版后 header
换成了 el-select，那半边的前提已经不存在（2026-10-28 实测 TimeoutError），已删掉；
留下的是仍然成立的那一半。

比的是**形状**（字体、行高、高度、内边距、圆角、边框宽度、原生外观），不比颜色 ——
按钮的 primary / disabled 等变体本来就该有不同颜色。

用法（需先启动 playground）：
    pnpm playground
    python scripts/visual/compare-controls.py [端口]

退出码非 0 表示存在不一致；**某个 demo 没扫到按钮也算失败**（改名或渲染坏掉时不能静默通过）。
"""

import json
import sys

from playwright.sync_api import sync_playwright

# Windows 控制台默认 GBK，print("✓") 会 UnicodeEncodeError（verify-admin 实测崩过）。
# CI 是 UTF-8 不踩这个坑，本地会；统一兜一层，让两边都能完整跑完。
import sys as _sys_utf8

if hasattr(_sys_utf8.stdout, "reconfigure"):
    _sys_utf8.stdout.reconfigure(encoding="utf-8", errors="replace")


PORT = sys.argv[1] if len(sys.argv) > 1 else "5174"
URL = f"http://localhost:{PORT}/"

# 渲染了 .fbk-demo-btn 的 demo（`grep -rl fbk-demo-btn packages/internal/demos/src` 得出）。
# demo 改名后这里会扫到 0 个按钮并报错 —— 那正是我们要的：静默扫空等于没检查。
DEMOS = [
    "crud-page/basic",
    "dashboard/basic",
    "detail-page/basic",
    "feedback/basic",
    "form-modal/basic",
    "pro-table/selection",
    "result/basic",
]

# 形状类属性：这些必须跨 demo 一致
SHAPE_PROPS = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "height",
    "padding",
    "borderRadius",
    "borderWidth",
    "appearance",
]

MIN_BUTTONS = 5


def demo_url(demo: str) -> str:
    """Playground 支持 `#/<demo>?adapter=&theme=` 深链（见 apps/playground/src/App.vue）。

    直接导航比操作侧边栏稳，也不依赖 UI 结构。
    """
    return f"{URL}#/{demo}?adapter=element-plus&theme=light"


def main() -> int:
    collected = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})

        for demo in DEMOS:
            page.goto(demo_url(demo))
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1200)

            buttons = page.evaluate(
                """(props) => [...document.querySelectorAll('.fbk-demo-btn')].map((el) => {
                     const cs = getComputedStyle(el)
                     const shape = {}
                     for (const k of props) shape[k] = cs[k]
                     return { text: el.textContent.trim().slice(0, 12), shape }
                   })""",
                SHAPE_PROPS,
            )
            if not buttons:
                print(f"✗ [{demo}] 没扫到任何 .fbk-demo-btn")
                print("   demo 改名了，或这一页渲染失败。不要把它当成「通过」。")
                return 1
            collected.extend({"demo": demo, **b} for b in buttons)

        browser.close()

    print(f"扫描 {len(DEMOS)} 个 demo，共 {len(collected)} 个 .fbk-demo-btn\n")

    if len(collected) < MIN_BUTTONS:
        print(f"✗ 只扫到 {len(collected)} 个按钮（少于 {MIN_BUTTONS}），扫描多半坏了")
        return 1

    # 用出现次数最多的形状作为基准：大多数页面正确的那个才是基准，
    # 而不是「第一个扫到的」—— 第一个可能正好是被压坏的那一页。
    groups: dict[str, list] = {}
    for item in collected:
        key = json.dumps(item["shape"], sort_keys=True, ensure_ascii=False)
        groups.setdefault(key, []).append(item)

    ranked = sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True)
    base_key, base_items = ranked[0]
    base_shape = json.loads(base_key)

    print("=" * 70)
    print(f"基准形状（{len(base_items)}/{len(collected)} 个按钮）")
    print("=" * 70)
    for k in SHAPE_PROPS:
        print(f"  {k:14} {base_shape[k]}")

    if len(ranked) == 1:
        print(f"\n全部 {len(collected)} 个 .fbk-demo-btn 形状一致")
        return 0

    print(f"\n✗ 有 {len(ranked) - 1} 组偏离基准：")
    for key, items in ranked[1:]:
        shape = json.loads(key)
        diffs = {k: (base_shape[k], shape[k]) for k in SHAPE_PROPS if base_shape[k] != shape[k]}
        for item in items:
            print(f'  [{item["demo"]}] "{item["text"]}"')
            for k, (base_v, got_v) in diffs.items():
                print(f"      {k:14} 基准={base_v!r:28} 实际={got_v!r}")
    print("\n同一套演示控件在某一页被组件样式压过了 —— 这正是这个脚本要抓的。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
