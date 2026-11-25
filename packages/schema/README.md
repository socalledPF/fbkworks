# @fbkworks/schema

字段元数据的单一来源：**一份定义，派生 query / column / form 三份视图**。

写三遍字段的代价不是打字，是**漂移**：改了标签忘了改列头、加了选项忘了加查询下拉，
两处都合法、两处都编译通过。本包让「同一实体只有一个字段清单」变成可以照着写的事实。

纯函数、零依赖、不引 vue —— 入参和返回值都是普通对象，node 里能直接跑。

```bash
pnpm add @fbkworks/schema
```

## 用法

```ts
import { defineFields, toColumns, toFormFields, toQueryFields } from '@fbkworks/schema'

const orderFields = defineFields([
  {
    name: 'status',
    label: '状态',
    type: 'select',
    options: ORDER_STATUS,
    query: { placeholder: '全部' },         // → QueryForm 的 fields
    column: { width: 120, sortable: true }, // → ProTable 的 columns
    form: { required: true },               // → FormGenerator 的 schema.fields
  },
  { name: 'amount', label: '金额', type: 'number' },
  // 只出现在表单里：把这条字段从查询和表格里摘掉，不用在别处写排除
  { name: 'remark', label: '备注', type: 'textarea', views: ['form'] },
])

toQueryFields(orderFields) // [{ name: 'status', label: '状态', type: 'select', options, placeholder: '全部' }, …]
toColumns(orderFields)     // [{ …, width: 120, sortable: true }, …]
toFormFields(orderFields)  // [{ …, required: true }, …]
```

| 导出 | 说明 |
|---|---|
| `defineFields` | 声明定义；保留 `type` 的字面量类型 |
| `toQueryFields` | 派生 QueryForm 的 `fields` |
| `toColumns` | 派生表格的 `columns` |
| `toFormFields` | 派生 FormGenerator 的 `schema.fields` |
| `FieldMeta` / `FieldType` / `FieldView` | 类型 |

## 派生规则（`tests/derive.spec.ts` 逐条钉住）

1. **`views` 缺省 = 三个视图都出现**；显式给出则只出现在列出的视图里。`views: []` 是
   「一个都不要」，与「没写」相反 —— 实现里这两支必须分开写，写成 `field.views ?? []` 会把
   所有字段从三个视图里一起抹掉。
2. 派生对象 = `{ name, label, type, …通用键 }` + 该视图的附加配置；**同名的视图键覆盖通用键**
   （`form: { options }` 只影响表单那一份）。
3. 每次调用返回**新对象**，改派生结果不会污染原定义。
4. `type` 是三端中立的字面量：select 就是 select，不映射成任何 UI 库的命名，
   `'el-select'` 这类值会被类型拦下。

## 不可变性的边界

顶层键是全新的；`options` 这类**嵌套值按引用共享**，这是刻意取舍而不是遗漏：深拷贝会换掉
每个选项对象的身份，而表单/表格库普遍按引用比对选中项（`v-model` 回填时会「选不中」）。
要改选项请改原定义，不要在派生结果上就地改。

## License

MIT
