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
import { vantTheme } from './theme'
import { RootProvider } from './root-provider'

export const vantCapabilities: Capabilities = {
  dataGrid: {
    presentation: 'cards',
    selection: true,
    /* 卡片列表没有表头，全文也没有一处 emit('update:sort')；
       补齐移动端排序入口（下拉 / 筛选栏 / 顶栏菜单）需要产品方案，故声明为 none。 */
    sort: 'none',
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
  // van-popup 的 position 就是抽屉：Drawer 原语已实现，能力声明必须跟上
  overlay: { kind: 'popup', supportsDrawer: true, supportsTeleport: true },
  pagination: { mode: 'infinite', pageSizes: false, jumper: false },
  // 只有契约里真实存在的两个 API；notification / loading 没有对应实现，不声明
  feedback: { message: true, notification: false, confirm: true, loading: false },
  theme: { darkMode: true, provider: true },
  features: { 'table.fixedColumns': false, 'table.summary': false, 'form.inline': false },
}

export const vantAdapter: UiAdapter = {
  meta: {
    apiVersion: 3,
    name: 'vant',
    version: '0.1.0',
    uiLibrary: { name: 'vant', version: '^4.9.0' },
    platform: 'mobile',
  },
  capabilities: vantCapabilities,
  primitives: { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Drawer, Tag, Spin },
  feedback,
  RootProvider,
  theme: vantTheme,
}

export { vantTheme, RootProvider }
export { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Drawer, Tag, Spin }
