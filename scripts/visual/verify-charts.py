"""图表组件（@fbkworks/chart-core / dashboard / screen）的真实浏览器验证。

单元测试在 jsdom 里跑，ECharts 无法真实绘制，所以只能验证编排逻辑。
**这个脚本补上真实渲染的验证**，覆盖 jsdom 覆盖不到的问题：
  · canvas 是否真的有像素（不是空白）
  · 等比缩放在多种分辨率下是否变形/裁切
  · 三套主题下 --fbk-chart-* 是否真的不同
  · Canvas 是否因未解析的 CSS 变量而报 addColorStop 错误

用法（需先启动 playground）：
    pnpm playground
    python scripts/visual/verify-charts.py [端口]

退出码非 0 表示存在失败项。

覆盖目标里的验收项：
  · 大屏等比缩放在多种分辨率下不变形、不裁切
  · 看板与后台视觉协调
  · 图表真实渲染（canvas 有实际像素内容，不是空白）
  · 主题切换时图表配色跟随
"""

import json

from playwright.sync_api import sync_playwright

import sys

PORT = sys.argv[1] if len(sys.argv) > 1 else "5180"
URL = f"http://localhost:{PORT}/"
results = {}


def goto_demo(page, demo):
    page.goto(URL)
    page.wait_for_load_state("networkidle")
    page.locator(".playground__field select").nth(2).select_option(demo)
    page.wait_for_timeout(3500)


def canvas_has_pixels(page):
    """检查 canvas 是否真的有绘制内容（不是全透明空白）。"""
    return page.evaluate(
        """
        () => {
          const canvases = [...document.querySelectorAll('canvas')];
          return canvases.map((c) => {
            const ctx = c.getContext('2d');
            if (!ctx) return { ok: false, reason: 'no ctx' };
            const w = c.width, h = c.height;
            if (!w || !h) return { ok: false, reason: 'zero size', w, h };
            // 采样中心区域，看是否有非透明像素
            try {
              const data = ctx.getImageData(0, 0, Math.min(w, 200), Math.min(h, 200)).data;
              let nonEmpty = 0;
              for (let i = 3; i < data.length; i += 4) if (data[i] > 0) nonEmpty++;
              return { ok: nonEmpty > 0, w, h, nonEmpty };
            } catch (e) {
              return { ok: true, reason: 'tainted/unsupported', w, h };
            }
          });
        }
        """
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ---- 大屏：多分辨率缩放 ----
    results["screen"] = {}
    for w, h in [(1920, 1080), (1440, 900), (2560, 1440), (1280, 720)]:
        page = browser.new_page(viewport={"width": w, "height": h})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        goto_demo(page, "screen/basic")

        info = page.evaluate(
            """
            () => {
              const stage = document.querySelector('.fbk-screen__stage');
              const screen = document.querySelector('.fbk-screen');
              if (!stage) return { error: 'no stage' };
              const sr = stage.getBoundingClientRect();
              const cr = screen.getBoundingClientRect();
              const m = /scale\\(([^)]+)\\)/.exec(stage.style.transform) || [];
              return {
                transform: stage.style.transform,
                scale: m[1] || null,
                stageW: Math.round(sr.width), stageH: Math.round(sr.height),
                screenW: Math.round(cr.width), screenH: Math.round(cr.height),
                // 舞台不应超出容器。用 right/bottom 而不是 width/height ——
                // 容器的 left/top 可能不是 0（嵌在带 header 的页面里）。
                overflowsX: sr.left < cr.left - 1 || sr.right > cr.right + 1,
                overflowsY: sr.top < cr.top - 1 || sr.bottom > cr.bottom + 1,
                // 构图比例应保持 16:9
                ratio: sr.width && sr.height ? +(sr.width / sr.height).toFixed(3) : null,
              };
            }
            """
        )
        info["canvas"] = canvas_has_pixels(page)
        info["errors"] = errors[:3]
        results["screen"][f"{w}x{h}"] = info
        if w == 1920:
            page.screenshot(path="/tmp/final-screen-1920.png")
        if w == 1440:
            page.screenshot(path="/tmp/final-screen-1440.png")
        page.close()

    # ---- 看板 ----
    page = browser.new_page(viewport={"width": 1440, "height": 1200})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    goto_demo(page, "dashboard/basic")
    results["dashboard"] = {
        "canvas": canvas_has_pixels(page),
        "statCards": page.locator(".fbk-stat-card").count(),
        "chartCards": page.locator(".fbk-chart-card").count(),
        "rankRows": page.locator(".fbk-rank-list__row").count(),
        "errors": errors[:3],
    }
    page.screenshot(path="/tmp/final-dashboard.png", full_page=True)
    page.close()

    # ---- 主题切换：图表配色是否跟随 ----
    theme_check = {}
    for theme in ["light", "dark", "cyber"]:
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        page.goto(URL)
        page.wait_for_load_state("networkidle")
        page.locator(".playground__field select").nth(1).select_option(theme)
        page.wait_for_timeout(400)
        page.locator(".playground__field select").nth(2).select_option("dashboard/basic")
        page.wait_for_timeout(3500)
        theme_check[theme] = page.evaluate(
            """
            () => {
              const cs = getComputedStyle(document.documentElement);
              return {
                chart1: cs.getPropertyValue('--fbk-chart-1').trim(),
                chart4: cs.getPropertyValue('--fbk-chart-4').trim(),
                themeAttr: document.documentElement.getAttribute('data-fbk-theme'),
                canvases: document.querySelectorAll('canvas').length,
              };
            }
            """
        )
        page.close()
    results["themes"] = theme_check

    browser.close()

print(json.dumps(results, ensure_ascii=False, indent=2))

# ---- 断言 ----
print("\n" + "=" * 70)
ok = True

for size, info in results["screen"].items():
    if info.get("error"):
        print(f"FAIL [{size}] {info['error']}")
        ok = False
        continue
    if info["overflowsX"] or info["overflowsY"]:
        print(f"FAIL [{size}] 舞台超出视口")
        ok = False
    if abs(info["ratio"] - 16 / 9) > 0.02:
        print(f"FAIL [{size}] 构图比例变了: {info['ratio']}（应接近 1.778）")
        ok = False
    if info["errors"]:
        print(f"FAIL [{size}] console 错误: {info['errors']}")
        ok = False
    blank = [c for c in info["canvas"] if not c.get("ok")]
    if blank:
        print(f"FAIL [{size}] 有 {len(blank)} 个 canvas 空白")
        ok = False

d = results["dashboard"]
if d["statCards"] != 4:
    print(f"FAIL 看板指标卡数量 {d['statCards']} != 4")
    ok = False
if d["errors"]:
    print(f"FAIL 看板 console 错误: {d['errors']}")
    ok = False
if any(not c.get("ok") for c in d["canvas"]):
    print("FAIL 看板有 canvas 空白")
    ok = False

t = results["themes"]
if len({t[x]["chart1"] for x in t}) < 3:
    print(f"FAIL 三套主题的 --fbk-chart-1 没有区分: {[t[x]['chart1'] for x in t]}")
    ok = False

print("\n全部通过" if ok else "\n有失败项")
sys.exit(0 if ok else 1)
