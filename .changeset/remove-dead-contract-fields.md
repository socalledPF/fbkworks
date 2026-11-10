---
"@fbkworks/adapter-core": minor
"@fbkworks/components": minor
"@fbkworks/adapter-element-plus": minor
"@fbkworks/adapter-naive-ui": minor
"@fbkworks/adapter-vant": minor
---

### 删掉契约里两个「说谎」的字段

公开 API 承诺了、实现里没有 —— 使用者照类型写代码会静默无效。这比缺功能更糟：
缺功能至少会报错，死字段只会让人以为是自己的用法不对。

**`DataGridProps.presentation`** —— 三个适配器一次都没读过它（`grep props.presentation` = 0）。
传 `presentation: 'cards'` 得到的是「卡片类的外壳 + 表格 DOM」。
展示形态唯一的真相是能力位 `capabilities.dataGrid.presentation`，**它保留**，
ProTable 的外壳类名本来就取自它。

**`DataGridProps.sort`（入参）** —— 只有 element-plus 读过（用来设 `defaultSort`），
naive / vant 完全忽略，等于受控排序在 2/3 适配器上不生效。现在删掉，
排序的对外契约只剩事件 `update:sort`（ProTable 据此发起请求）。
`ProTableProps.sort` **保留**：它是查询状态的受控入口，被真实读取。

**`ProTableProps.toolbar`** —— 代码里只判断 `$slots.toolbar`，从不读这个 prop，
传 `:toolbar="false"` 没有任何效果。插槽 `#toolbar` 保留。

> 破坏性变更：删除上述三个 prop。仍在传它们的调用处会得到类型错误
> （这正是想要的：让静默失效变成编译期报错）。
**`ProTableProps.sort`** —— 删掉 `DataGridProps.sort` 之后它只剩「播种内部状态」，
驱动不了任何 UI。留着它是**半死路径**：错误重试会把 DataGrid 整块重挂，
表头箭头全灭而内部排序仍在生效，界面显示的排序与实际数据顺序相反。
排序现在是纯事件驱动：点表头 → `update:sort` → 你据此请求。
需要初始排序时写进 `params` 或 `request` 闭包里。

**`ProTableUiProps.actions`** —— 声明了但全仓零读取，传了静默无效（与 toolbar 同一类）。
