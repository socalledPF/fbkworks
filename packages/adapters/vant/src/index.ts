import type { Capabilities, UiAdapter } from '@fbk/adapter-core'
import { Button } from './primitives/Button'
import { Input } from './primitives/Input'
import { Select } from './primitives/Select'
import { Checkbox } from './primitives/Checkbox'
import { Form, FormItem } from './primitives/Form'
import { DataGrid } from './primitives/DataGrid'
import { Pagination } from './primitives/Pagination'
import { Dialog } from './primitives/Dialog'
import { Tag } from './primitives/Tag'
import { Empty } from './primitives/Empty'
import { Spin } from './primitives/Spin'
import { vantTheme } from './theme'
import { RootProvider } from './root-provider'

export const vantCapabilities: Capabilities = {
  dataGrid: {
    presentation: 'cards',
    selection: true,
    sort: 'custom',
    expandable: false,
    tree: false,
    virtualScroll: false,
    stickyHeader: false,
  },
  form: {
    layout: 'vertical',
    labelWidth: false,
    validateOn: ['change', 'blur', 'submit'],
    asyncValidator: true,
  },
  overlay: { kind: 'popup', supportsDrawer: false, supportsTeleport: true },
  pagination: { mode: 'infinite', pageSizes: false, jumper: false },
  feedback: { message: true, notification: true, confirm: true, loading: true },
  theme: { darkMode: true, cssVariables: true, provider: true },
  features: { 'table.fixedColumns': false, 'table.summary': false, 'form.inline': false },
}

export const vantAdapter: UiAdapter = {
  meta: {
    apiVersion: 1,
    name: 'vant',
    version: '0.1.0',
    uiLibrary: { name: 'vant', version: '^4.9.0' },
    platform: 'mobile',
  },
  capabilities: vantCapabilities,
  primitives: { Button, Input, Select, Checkbox, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin },
  RootProvider,
  theme: vantTheme,
}

export { vantTheme, RootProvider }
export { Button, Input, Select, Checkbox, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin }
