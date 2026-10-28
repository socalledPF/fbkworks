import { runAdapterConformance } from '@fbk/adapter-conformance'
import { mountWithProvider } from '@fbk/test-utils'
import { naiveUiAdapter } from '../src'

runAdapterConformance({
  adapter: naiveUiAdapter,
  mount: (component, props) => mountWithProvider(component, { adapter: naiveUiAdapter, props }),
  selectors: {
    row: '.n-data-table-tbody .n-data-table-tr',
    selection: '.n-data-table-tbody .n-checkbox',
    // 第 1 页时上一页按钮 disabled，未禁用的按钮即为下一页
    nextPage: '.n-pagination > .n-pagination-item--button:not(.n-pagination-item--disabled)',
    // NDataTable 的 loading 浮层（内部主表格上方那层，只在 loading 时挂载）
    loading: '.n-data-table-loading-wrapper',
    // sortable 列的表头排序图标容器
    sortTrigger: '.n-data-table-thead .n-data-table-sorter',
  },
})
