import type { Capabilities, UiAdapter } from '@fbk/adapter-core'
import { Button } from './primitives/Button'
import { Input } from './primitives/Input'
import { Select } from './primitives/Select'
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
  feedback: { message: true, notification: true, confirm: true, loading: true },
  theme: { darkMode: true, cssVariables: false, provider: true },
  features: { 'table.fixedColumns': true, 'table.summary': true, 'form.inline': true },
}

export const naiveUiAdapter: UiAdapter = {
  meta: {
    apiVersion: 1,
    name: 'naive-ui',
    version: '0.1.0',
    uiLibrary: { name: 'naive-ui', version: '^2.40.0' },
    platform: 'desktop',
  },
  capabilities: naiveCapabilities,
  primitives: { Button, Input, Select, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin },
  RootProvider,
  theme: naiveTheme,
}

export { naiveTheme, naiveProviderProps, RootProvider }
export { Button, Input, Select, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin }
