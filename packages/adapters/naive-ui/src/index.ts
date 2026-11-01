import type { Capabilities, UiAdapter } from '@fbkworks/adapter-core'
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
import { Drawer } from './primitives/Drawer'
import { Tag } from './primitives/Tag'
import { Spin } from './primitives/Spin'
import { naiveTheme, naiveProviderProps } from './theme'
import { RootProvider } from './root-provider'

export const naiveCapabilities: Capabilities = {
  dataGrid: {
    presentation: 'table',
    selection: true,
    sort: 'custom',
    /* 下面四个位此前声明为 true，但 DataGridProps 里根本没有对应 prop ——
       也就是说它们不只是没实现，而是连请求的入口都不存在。声明 true 会让
       调用方按能力位分支却拿到一条平铺的表。要真支持，需要先加 prop、
       三个适配器各实现、再补一致性用例，那是一轮独立设计。 */
    expandable: false,
    tree: false,
    virtualScroll: false,
    stickyHeader: false,
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
    apiVersion: 3,
    name: 'naive-ui',
    version: '0.1.0',
    uiLibrary: { name: 'naive-ui', version: '^2.40.0' },
    platform: 'desktop',
  },
  capabilities: naiveCapabilities,
  primitives: { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Drawer, Tag, Spin },
  feedback,
  RootProvider,
  theme: naiveTheme,
}

export { naiveTheme, naiveProviderProps, RootProvider }
export { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Drawer, Tag, Spin }
