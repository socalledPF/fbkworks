"""后台管理系统 demo（apps/admin）的端到端验证。

这个脚本是「吃自己的狗粮」测试的核心：用组件库搭一个真实后台，
然后用真实浏览器走一遍完整流程，验证组件在**组合场景**下是否可用。

单测覆盖单组件，这里覆盖的是「页面级」问题：
  · CrudPage + FormModal + PageContainer 组合后布局是否正确
  · 主题切换是否同时作用于令牌层与 UI 库层
  · 工具栏/批量条/表格的层级顺序
  · 筛选、排序、分页在真实请求链路下是否生效

用法（需先启动 admin）：
    pnpm admin
    python scripts/visual/verify-admin.py [端口]

非 0 退出码表示失败。
"""
from playwright.sync_api import sync_playwright

import sys as _sys

PORT = _sys.argv[1] if len(_sys.argv) > 1 else "5185"
URL = f"http://localhost:{PORT}/"
ok = True

def check(cond, msg):
    global ok
    if not cond:
        print(f"  FAIL {msg}")
        ok = False
    else:
        print(f"  OK   {msg}")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    page.on("pageerror", lambda e: errs.append(f"PAGEERROR: {e}"))
    page.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)

    print("\n[1] 登录")
    page.goto(URL)
    page.wait_for_timeout(2000)
    check(page.locator(".login__card").count() == 1, "登录页渲染")
    page.locator(".login__submit").click()
    page.wait_for_timeout(2500)
    check(page.locator(".admin-layout").count() == 1, "登录后进入布局")

    print("\n[2] 工作台")
    check(page.locator(".fbk-stat-card").count() == 4, "4 个指标卡")
    check(page.locator("canvas").count() >= 2, "图表 canvas 已渲染")
    check(page.locator(".fbk-rank-list__row").count() > 0, "排行榜有数据")

    print("\n[3] 订单列表")
    page.evaluate("() => { location.hash = '/orders' }")
    page.wait_for_timeout(2500)
    check(page.locator(".fbk-crud-page").count() == 1, "CRUD 页渲染")
    rows = page.locator(".el-table__body tr").count()
    check(rows == 20, f"默认 20 行（实际 {rows}）")
    # 元素顺序：toolbar 应在 bulk 之前
    order = page.evaluate("""() => [...document.querySelector('.fbk-pro-table').children]
        .map(c => c.className.split(' ')[0]).slice(0, 3)""")
    check(order[0] == 'fbk-pro-table__toolbar' and order[1] == 'fbk-pro-table__bulk',
          f"工具栏在批量条之前（实际 {order[:2]}）")

    print("\n[4] 全选与批量条")
    page.locator(".fbk-pro-table__select-all input").check()
    page.wait_for_timeout(800)
    bulk = page.locator(".fbk-pro-table__bulk").inner_text()
    check("已选 20" in bulk, f"批量条显示已选数量（{bulk[:40].strip()}）")

    print("\n[5] 新建弹窗")
    page.locator('.admin-btn--primary', has_text="新建订单").click()
    page.wait_for_timeout(1500)
    dlg = page.locator(".el-dialog").first
    check(dlg.is_visible(), "弹窗打开")
    check(dlg.locator(".el-form-item").count() >= 8, "弹窗含 8+ 字段")
    page.keyboard.press("Escape")
    page.wait_for_timeout(800)

    print("\n[6] 筛选")
    page.fill('input[placeholder="订单号 / 客户 / 手机"]', "SO2026000001")
    page.locator('.el-button--primary', has_text="查询").click()
    page.wait_for_timeout(2000)
    filtered = page.locator(".el-table__body tr").count()
    check(filtered <= 2, f"筛选后行数减少（{filtered}）")

    print("\n[7] 排序")
    # 先重置筛选：改 hash 只是切页面，查询表单的值会留在同一实例里
    page.locator('.el-button', has_text="重置").first.click()
    page.wait_for_timeout(2200)
    # 按列名定位，避免硬编码列索引（表格列顺序会变）
    def first_amount():
        return page.evaluate("""() => {
            const headers = [...document.querySelectorAll('.el-table__header th')].map(t => t.innerText.trim());
            const idx = headers.findIndex(h => h.includes('金额'));
            const cell = document.querySelectorAll('.el-table__body tr')[0]?.querySelectorAll('td')[idx];
            return cell ? cell.innerText.trim() : null;
        }""")

    before = first_amount()
    page.locator(".el-table__header th", has_text="金额").click()
    page.wait_for_timeout(2500)
    after = first_amount()
    check(before != after, f"排序改变了首行金额（{before} → {after}）")

    print("\n[8] 用户管理")
    page.evaluate("() => { location.hash = '/users' }")
    page.wait_for_timeout(2200)
    check(page.locator(".fbk-crud-page").count() == 1, "用户页渲染")
    check(page.locator(".el-table__body tr").count() > 0, "用户表格有数据")

    print("\n[9] 系统设置")
    page.evaluate("() => { location.hash = '/settings' }")
    page.wait_for_timeout(2200)
    check(page.locator(".fbk-form-generator").count() == 1, "设置页表单渲染")
    check(page.locator(".el-form-item").count() >= 10, "表单字段齐全")

    print("\n[10] 订单详情")
    page.evaluate("() => { location.hash = '/orders' }")
    page.wait_for_timeout(2000)
    page.locator('.el-table__body tr').first.locator('a, button', has_text="详情").first.click()
    page.wait_for_timeout(2200)
    check("/orders/" in page.url, f"跳转到详情（{page.url.split('#')[-1]}）")
    check(page.locator(".fbk-descriptions").count() >= 1, "详情用 Descriptions 渲染")

    print("\n[11] 异常页")
    for kind in ["403", "404"]:
        page.evaluate(f"() => {{ location.hash = '/{kind}' }}")
        page.wait_for_timeout(1500)
        check(page.locator(".fbk-result").count() >= 1, f"{kind} 用 Result 渲染")

    print("\n[12] 暗色主题")
    page.evaluate("() => { location.hash = '/orders' }")
    page.wait_for_timeout(2000)
    page.locator('.admin-topbar__icon-btn[aria-label*="暗色"]').click()
    page.wait_for_timeout(1500)
    theme = page.evaluate("""() => ({
        htmlClass: document.documentElement.className,
        dataTheme: document.documentElement.getAttribute('data-fbk-theme'),
        elBg: getComputedStyle(document.documentElement).getPropertyValue('--el-bg-color').trim(),
    })""")
    check(theme["htmlClass"] == "dark", f"html.dark 已挂（{theme['htmlClass']}）")
    check(theme["dataTheme"] == "dark", f"data-fbk-theme 已切（{theme['dataTheme']}）")
    check(theme["elBg"] != "#ffffff", f"element-plus 变量已跟随（{theme['elBg']}）")

    print("\n[13] console 错误")
    check(len(errs) == 0, f"无 console 错误（{errs[:3] if errs else '无'}）")

    b.close()

print("\n" + "=" * 50)
print("全部通过" if ok else "有失败项")
_sys.exit(0 if ok else 1)
