import { runAdapterConformance } from '@fbk/adapter-conformance'
import { mountWithProvider } from '@fbk/test-utils'
import { elementPlusAdapter } from '../src'

runAdapterConformance({
  adapter: elementPlusAdapter,
  mount: (component, props) =>
    mountWithProvider(component, { adapter: elementPlusAdapter, props }),
  selectors: {
    row: '.el-table__body tbody tr',
    selection: '.el-table__body .el-checkbox__original',
    nextPage: '.el-pagination .btn-next',
  },
})
