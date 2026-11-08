"""Playground 界面的端到端验证。

设计见 docs/design/2026-10-23-playground-redesign.md。

覆盖：
  · 侧边栏分组与搜索过滤
  · 切换 demo（内容与 URL 同步）
  · 源码抽屉（打开 / Esc 关闭）
  · 三套主题下侧边栏与顶栏配色跟随
  · 大屏 demo 不被裁切
  · URL 深链还原

用法（需先启动 playground）：
    pnpm playground
    python scripts/visual/verify-playground.py [端口]

非 0 退出码表示失败。
"""

import json
import sys

from playwright.sync_api import sync_playwright

# Windows 控制台默认 GBK，print("✓") 会 UnicodeEncodeError（verify-admin 实测崩过）。
# CI 是 UTF-8 不踩这个坑，本地会；统一兜一层，让两边都能完整跑完。
import sys as _sys_utf8

if hasattr(_sys_utf8.stdout, "reconfigure"):
    _sys_utf8.stdout.reconfigure(encoding="utf-8", errors="replace")


PORT = sys.argv[1] if len(sys.argv) > 1 else "5175"
URL = f"http://localhost:{PORT}/"

ok = True


def check(cond, msg):
    global ok
    if cond:
        print(f"  OK   {msg}")
    else:
        print(f"  FAIL {msg}")
        ok = False


with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    page.on("pageerror", lambda e: errs.append(f"PAGEERROR: {e}"))
    page.on(
        "console",
        lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None,
    )

    print("\n[1] 侧边栏")
    page.goto(URL)
    page.wait_for_timeout(3000)
    groups = page.locator(".pg-sidebar__group-title").all_inner_texts()
    check(len(groups) == 6, f"6 个分组（实际 {len(groups)}）")
    items = page.locator(".pg-sidebar__item").count()
    check(items >= 13, f"至少 13 个 demo 项（实际 {items}）")

    print("\n[2] 搜索过滤")
    page.fill(".pg-sidebar__search input", "表单")
    page.wait_for_timeout(700)
    filtered = page.locator(".pg-sidebar__item").count()
    check(0 < filtered < items, f"过滤后条目减少（{items} → {filtered}）")
    page.fill(".pg-sidebar__search input", "")
    page.wait_for_timeout(500)

    print("\n[3] 切换 demo 与 URL 同步")
    page.locator(".pg-sidebar__item", has_text="数据看板").click()
    page.wait_for_timeout(2800)
    title = page.locator(".pg__title").inner_text()
    hash_ = page.evaluate("() => location.hash")
    check(title == "数据看板", f"标题更新（{title}）")
    check("dashboard/basic" in hash_, f"URL 同步（{hash_}）")
    check(page.locator("canvas").count() > 0, "图表已渲染")

    print("\n[4] 源码抽屉")
    page.locator(".pg__switch .el-switch").click()
    page.wait_for_timeout(900)
    check(page.locator(".pg-drawer.is-open").count() == 1, "抽屉打开")
    check(len(page.locator(".pg-drawer__code").inner_text()) > 50, "抽屉有源码")
    page.keyboard.press("Escape")
    page.wait_for_timeout(700)
    check(page.locator(".pg-drawer.is-open").count() == 0, "Esc 关闭抽屉")

    print("\n[5] 大屏不裁切")
    page.locator(".pg-sidebar__item", has_text="可视化大屏").click()
    page.wait_for_timeout(3500)
    info = page.evaluate(
        """() => {
          const s = document.querySelector('.fbk-screen__stage');
          const body = document.querySelector('.pg__body');
          const sr = s?.getBoundingClientRect();
          const br = body?.getBoundingClientRect();
          return {
            hasStage: !!s,
            overflow: sr && br ? (sr.left < br.left - 1 || sr.right > br.right + 1) : null,
            canvas: document.querySelectorAll('canvas').length,
          };
        }"""
    )
    check(info["hasStage"], "大屏舞台存在")
    check(info["overflow"] is False, "舞台未超出内容区")
    check(info["canvas"] >= 4, f"4 个图表 canvas（实际 {info['canvas']}）")

    print("\n[6] 三套主题")
    for theme in ["light", "dark", "cyber"]:
        page.goto(f"{URL}#/pro-table/basic?adapter=element-plus&theme={theme}")
        page.wait_for_timeout(2500)
        got = page.evaluate(
            """() => ({
              theme: document.documentElement.getAttribute('data-fbk-theme'),
              sidebar: getComputedStyle(document.querySelector('.pg-sidebar')).backgroundColor,
              topbar: getComputedStyle(document.querySelector('.pg__topbar')).backgroundColor,
            })"""
        )
        check(got["theme"] == theme, f"{theme}：主题已应用")
        check(
            got["sidebar"] == got["topbar"],
            f"{theme}：侧边栏与顶栏同色（{got['sidebar']}）",
        )

    print("\n[7] URL 深链")
    page.goto(f"{URL}#/pro-table/selection?adapter=naive-ui&theme=cyber")
    page.wait_for_timeout(3000)
    check(page.locator(".pg__title").inner_text() == "多选与批量操作", "标题还原")
    adapter_text = page.locator(".pg__topbar-right .el-select").first.inner_text()
    check("naive-ui" in adapter_text, f"适配器还原（{adapter_text.strip()}）")
    theme_now = page.evaluate("() => document.documentElement.getAttribute('data-fbk-theme')")
    check(theme_now == "cyber", f"主题还原（{theme_now}）")

    print("\n[8] console 错误")
    check(len(errs) == 0, f"无错误（{errs[:3] if errs else '无'}）")

    b.close()

print("\n" + "=" * 50)
print("全部通过" if ok else "有失败项")
sys.exit(0 if ok else 1)
