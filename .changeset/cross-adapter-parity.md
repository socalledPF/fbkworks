---
"@fbkworks/data": minor
"@fbkworks/chart-core": patch
"@fbkworks/screen": patch
"@fbkworks/adapter-element-plus": patch
"@fbkworks/adapter-naive-ui": patch
"@fbkworks/adapter-vant": patch
"@fbkworks/components": patch
---

### 跨适配器语义对齐与几处静默失效

**loading 期间不再渲染空态（element-plus / naive-ui）** —— 首帧 data 必然是空的，
此时喊「暂无数据」等于把「正在加载」说成「没有数据」。vant 一直是抑制的，
桌面端两库没有，同一份业务代码换库外观就不同。现在三家一致，并进了一致性套件。

**loadMore / finished 不再透成 DOM 属性（element-plus / naive-ui）** —— 桌面端两库不声明
这两个字段，ProTable 无条件传过来时它们落进 attrs 并被展开到表格根节点，
变成 loadmore="false" finished="false" 这类非法属性，@load-more 也变成原生事件监听器。

**reload() 清空选中时 emit update:selectedKeys（components）** —— selectedKeys 是受控 prop，
只改内部值会让父级 v-model 停在旧值：父级批量操作栏显示「已选 1 项」并可执行删除，
而表格里已经一个都没勾。同时把清空移到「受控 data 直接返回」之前，
否则 selection.preserveOnReload: false 配 :data 时是彻底的空操作。

**大屏四个图表转发 @error（screen）** —— FbkChart 只 emit 不 console，大屏此前一个都没监听：
配置写错时图表静默保留上一帧或空白，生产环境没有任何信号。

**setOption 的 replaceMerge 扩到 dataZoom / visualMap / geo（chart-core）** —— 只替换
series/legend 时，被删掉的缩放条与视觉映射会留在实例上（折线↔饼这类换图型会残留）。
坐标轴仍走合并：实测轴增减能正确归一，换成 replaceMerge 反而每帧重建。

**主题重建后补回 loading 遮罩（chart-core）** —— 重建实例会让遮罩跟着旧实例消失，
而 props.loading 没变、watcher 不触发，看起来像加载完了。

**isSuccess 返回 falsy 即失败（data）** —— 曾经写成 ok === false，于是
(res) => res.code / (res) => res.data?.ok 这类写法返回的 undefined / 0 / 空字符串
被当成成功，失败响应带空数组时用户看到「暂无数据」。

**取消判定覆盖 axios 与自定义 abort reason（data）** —— 第一判据改为 signal.aborted，
再叠加 AbortError / CanceledError / ERR_CANCELED 三种命名形状。此前 axios 的
CanceledError 与 abort(reason) 都会被当成错误上报，快速翻页时监控里全是噪音。

**total 必须是非负整数（data）** —— 负数与小数同样会让分页器显示错数。

**vant 的 size 写清语义** —— 移动端卡片没有尺寸档位，接受但不产生视觉效果；
声明它是为了不让它透成非法 DOM 属性，并保持默认值与桌面端一致。
