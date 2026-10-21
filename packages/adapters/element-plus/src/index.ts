import type { Capabilities, UiAdapter } from '@fbk/adapter-core'
import { Button } from './primitives/Button'
import { Input } from './primitives/Input'
import { Select } from './primitives/Select'
import { Checkbox } from './primitives/Checkbox'
import { DatePicker } from './primitives/DatePicker'
import { Radio } from './primitives/Radio'
import { Form, FormItem } from './primitives/Form'
import { DataGrid } from './primitives/DataGrid'
import { Pagination } from './primitives/Pagination'
import { Dialog } from './primitives/Dialog'
import { Tag } from './primitives/Tag'
import { Empty } from './primitives/Empty'
import { Spin } from './primitives/Spin'
import { elementTheme } from './theme'
import { RootProvider } from './root-provider'

export const elementPlusCapabilities: Capabilities = {
  dataGrid: {
    presentation: 'table',
    selection: true,
    sort: 'custom',
    expandable: true,
    tree: true,
    virtualScroll: false,
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
  feedback: { message: true, notification: true, confirm: true, loading: true },
  theme: { darkMode: true, cssVariables: true, provider: false },
  features: { 'table.fixedColumns': true, 'table.summary': true, 'form.inline': true },
}

export const elementPlusAdapter: UiAdapter = {
  meta: {
    apiVersion: 1,
    name: 'element-plus',
    version: '0.1.0',
    uiLibrary: { name: 'element-plus', version: '^2.8.0' },
    platform: 'desktop',
  },
  capabilities: elementPlusCapabilities,
  primitives: { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin },
  RootProvider,
  theme: elementTheme,
}

export { elementTheme, RootProvider }
export { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin }
