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

# Windows 控制台默认 GBK，print("✓") 会 UnicodeEncodeError（verify-admin 实测崩过）。
# CI 是 UTF-8 不踩这个坑，本地会；统一兜一层，让两边都能完整跑完。
import sys as _sys_utf8

if hasattr(_sys_utf8.stdout, "reconfigure"):
    _sys_utf8.stdout.reconfigure(encoding="utf-8", errors="replace")


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

    print("\n[11] 详情页（DetailPage）")
    # 详情页有数据时应渲染字段 + extra 插槽
    has_fields = page.locator(".fbk-descriptions").count() >= 1
    has_timeline = page.locator(".detail__timeline").count() >= 1
    check(has_fields, "详情页用 Descriptions 渲染字段")
    check(has_timeline, "extra 插槽渲染了时间线")

    # 访问不存在的 id → 应该渲染 404 而不是「加载失败」
    page.evaluate("() => { location.hash = '/orders/99999' }")
    page.wait_for_timeout(2500)
    not_found_text = page.evaluate("""() => {
        const el = document.querySelector('.admin-content');
        return el ? el.innerText.replace(/\\s+/g, ' ') : '';
    }""")
    check("内容不存在" in not_found_text, f"不存在的 id 渲染 404（{not_found_text[:40]}）")
    check("加载失败" not in not_found_text, "404 不被误报为加载失败")

    print("\n[12] 异常页")
    for kind in ["403", "404"]:
        page.evaluate(f"() => {{ location.hash = '/{kind}' }}")
        page.wait_for_timeout(1500)
        check(page.locator(".fbk-result").count() >= 1, f"{kind} 用 Result 渲染")

    print("\n[13] 暗色主题")
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

    print("\n[14] 可观测性上报")
    page.evaluate("() => { location.hash = '/orders' }")
    page.wait_for_timeout(2500)
    telemetry = page.evaluate("""() => {
        const panel = document.querySelector('.admin-telemetry');
        return {
            exists: !!panel,
            items: panel ? [...panel.querySelectorAll('li')].map(li => li.textContent.trim()) : [],
        };
    }""")
    check(telemetry["exists"], "上报面板存在")
    check(
        any("ProTable.request" in t for t in telemetry["items"]),
        f"收到请求事件（{telemetry['items'][:2]}）",
    )

    print("\n[15] 权限（v-permission）")
    def perm_state():
        return page.evaluate("""() => {
            const btns = [...document.querySelectorAll('.fbk-pro-table__bulk button')];
            const batch = btns.find(b => b.textContent.includes('批量删除'));
            return {
                batchExists: !!batch,
                rowDelete: [...document.querySelectorAll('.el-table__body a, .el-table__body button')]
                    .filter(el => el.textContent.trim() === '删除').length,
            };
        }""")

    on = perm_state()
    check(on["batchExists"], "有权限时批量删除存在")

    page.locator(".admin-topbar__perm").click()
    page.wait_for_timeout(1200)
    off = perm_state()
    # 核心断言：元素从 DOM 移除，不是 display:none
    check(not off["batchExists"], "无权限时批量删除从 DOM 移除（非隐藏）")
    check(off["rowDelete"] == 0, "无权限时行内删除按钮为 0")

    page.locator(".admin-topbar__perm").click()
    page.wait_for_timeout(1200)
    back = perm_state()
    check(back["batchExists"], "权限恢复后元素重新出现")

    print("\n[16] console 错误")
    check(len(errs) == 0, f"无 console 错误（{errs[:3] if errs else '无'}）")

    b.close()

print("\n" + "=" * 50)
print("全部通过" if ok else "有失败项")
_sys.exit(0 if ok else 1)
