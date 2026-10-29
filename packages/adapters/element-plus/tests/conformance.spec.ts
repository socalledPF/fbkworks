import { runAdapterConformance } from '@fbkworks/adapter-conformance'
import { mountWithProvider } from '@fbkworks/test-utils'
import { elementPlusAdapter } from '../src'

runAdapterConformance({
  adapter: elementPlusAdapter,
  mount: (component, props, slots) =>
    mountWithProvider(component, { adapter: elementPlusAdapter, props, slots }),
  selectors: {
    row: '.el-table__body tbody tr',
    selection: '.el-table__body .el-checkbox__original',
    nextPage: '.el-pagination .btn-next',
    // v-loading 指令挂出来的遮罩
    loading: '.el-table .el-loading-mask',
    // sortable 列的表头排序按钮（里面有 ascending/descending 两个箭头）
    sortTrigger: '.el-table__header .caret-wrapper',
  },
})
