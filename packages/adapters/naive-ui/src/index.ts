import type { Capabilities, UiAdapter } from '@fbk/adapter-core'
import { Button } from './primitives/Button'
import { Input } from './primitives/Input'
import { Select } from './primitives/Select'
import { Checkbox } from './primitives/Checkbox'
import { DatePicker } from './primitives/DatePicker'
import { Radio } from './primitives/Radio'
import { feedback } from './feedback'
import { Form, FormItem } from './primitives/Form'
import { DataGrid } from './primitives/DataGrid'
import { Pagination } from './primitives/Pagination'
import { Dialog } from './primitives/Dialog'
import { Tag } from './primitives/Tag'
import { Empty } from './primitives/Empty'
import { Spin } from './primitives/Spin'
import { naiveTheme, naiveProviderProps } from './theme'
import { RootProvider } from './root-provider'

export const naiveCapabilities: Capabilities = {
  dataGrid: {
    presentation: 'table',
    selection: true,
    sort: 'custom',
    expandable: true,
    tree: true,
    virtualScroll: true,
    stickyHeader: true,
  },
  form: {
    layout: 'horizontal',
    labelWidth: true,
    validateOn: ['change', 'blur', 'submit'],
    asyncValidator: true,
  },
  overlay: { kind: 'dialog', supportsDrawer: true, supportsTeleport: true },
  pagination: { mode: 'pages', pageSizes: true, jumper: true },
  // 只有契约里真实存在的两个 API；notification / loading 没有对应实现，不声明
  feedback: { message: true, notification: false, confirm: true, loading: false },
  theme: { darkMode: true, cssVariables: false, provider: true },
  features: { 'table.fixedColumns': true, 'table.summary': true, 'form.inline': true },
}

export const naiveUiAdapter: UiAdapter = {
  meta: {
    apiVersion: 2,
    name: 'naive-ui',
    version: '0.1.0',
    uiLibrary: { name: 'naive-ui', version: '^2.40.0' },
    platform: 'desktop',
  },
  capabilities: naiveCapabilities,
  primitives: { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin },
  feedback,
  RootProvider,
  theme: naiveTheme,
}

export { naiveTheme, naiveProviderProps, RootProvider }
export { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin }
