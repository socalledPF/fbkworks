import { defineComponent, h, ref, type PropType } from 'vue'
import { ADAPTER_API_VERSION } from '@fbkworks/adapter-core'
import type {
  Capabilities,
  ConfirmOptions,
  DataGridColumn,
  FeedbackApi,
  MessageApi,
  MessageOptions,
  MessageType,
  SortOrder,
  SortState,
  UiAdapter,
  UiPrimitives,
} from '@fbkworks/adapter-core'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export const defaultMockCapabilities: Capabilities = {
  dataGrid: {
    presentation: 'table',
    selection: true,
    sort: 'custom',
    expandable: true,
    tree: false,
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
  // 与真实适配器对齐：notification / loading 在 FeedbackApi 契约里没有对应成员，
  // 基座若声明 true，会让「读 capabilities 再调 API」的代码在测试里走进真实环境不存在的分支。
  feedback: { message: true, notification: false, confirm: true, loading: false },
  theme: { darkMode: true, provider: false },
  features: {},
}

function mergeCapabilities(
  base: Capabilities,
  overrides: DeepPartial<Capabilities> | undefined,
): Capabilities {
  if (!overrides) return base
  const result = { ...base } as Record<string, any>
  for (const [key, value] of Object.entries(overrides)) {
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? { ...(base as Record<string, any>)[key], ...value }
        : value
  }
  return result as Capabilities
}

/** 只输出语义化标记，不模拟任何 UI 库的 DOM 结构。 */
function createMockPrimitives(): UiPrimitives {
  const Button = defineComponent({
    name: 'MockButton',
    inheritAttrs: false,
    props: { disabled: Boolean, loading: Boolean },
    emits: ['click'],
    setup(props, { attrs, emit, slots }) {
      return () =>
        h(
          'button',
          {
            ...attrs,
            'data-fbk-part': 'button',
            disabled: props.disabled,
            onClick: (event: MouseEvent) => emit('click', event),
          },
          slots.default?.(),
        )
    },
  })

  const Input = defineComponent({
    name: 'MockInput',
    inheritAttrs: false,
    props: { modelValue: { type: [String, Number], default: '' }, disabled: Boolean },
    emits: ['update:modelValue', 'change', 'blur', 'focus'],
    setup(props, { attrs, emit }) {
      return () =>
        h('input', {
          ...attrs,
          'data-fbk-part': 'input',
          value: props.modelValue,
          disabled: props.disabled,
          onInput: (event: Event) =>
            emit('update:modelValue', (event.target as HTMLInputElement).value),
          onChange: (event: Event) => emit('change', (event.target as HTMLInputElement).value),
        })
    },
  })

  const Select = defineComponent({
    name: 'MockSelect',
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Number, Array], default: undefined },
      options: { type: Array as PropType<Array<{ label: string; value: string | number; disabled?: boolean }>>, default: () => [] },
      multiple: Boolean,
      disabled: Boolean,
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          'select',
          {
            ...attrs,
            'data-fbk-part': 'select',
            multiple: props.multiple,
            disabled: props.disabled,
            value: props.modelValue,
            onChange: (event: Event) => {
              const target = event.target as HTMLSelectElement
              const value = props.multiple
                ? Array.from(target.selectedOptions).map((option) => option.value)
                : target.value
              emit('update:modelValue', value)
            },
          },
          props.options.map((option: { label: string; value: string | number; disabled?: boolean }) =>
            h('option', { value: option.value, disabled: option.disabled }, option.label),
          ),
        )
    },
  })

  const Checkbox = defineComponent({
    name: 'MockCheckbox',
    inheritAttrs: false,
    props: { modelValue: Boolean, label: String, disabled: Boolean },
    emits: ['update:modelValue', 'change'],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          'label',
          { ...attrs, 'data-fbk-part': 'checkbox', 'data-checked': String(props.modelValue) },
          [
            h('input', {
              type: 'checkbox',
              disabled: props.disabled,
              checked: props.modelValue,
              onChange: (event: Event) => {
                const next = (event.target as HTMLInputElement).checked
                emit('update:modelValue', next)
                emit('change', next)
              },
            }),
            props.label ? h('span', { 'data-fbk-part': 'checkbox-label' }, props.label) : null,
          ],
        )
    },
  })

  const DatePicker = defineComponent({
    name: 'MockDatePicker',
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Array], default: undefined },
      type: { type: String, default: 'date' },
      placeholder: { type: [String, Array], default: undefined },
      disabled: Boolean,
      clearable: Boolean,
    },
    emits: ['update:modelValue', 'change'],
    setup(props, { attrs, emit }) {
      return () =>
        h('input', {
          ...attrs,
          'data-fbk-part': 'date-picker',
          'data-picker-type': props.type,
          value: Array.isArray(props.modelValue) ? props.modelValue.join('~') : (props.modelValue ?? ''),
          disabled: props.disabled,
          onInput: (event: Event) => {
            const next = (event.target as HTMLInputElement).value
            emit('update:modelValue', next)
            emit('change', next)
          },
        })
    },
  })

  const Radio = defineComponent({
    name: 'MockRadio',
    inheritAttrs: false,
    props: {
      modelValue: { type: [String, Number], default: undefined },
      options: { type: Array as PropType<Array<{ label: string; value: string | number; disabled?: boolean }>>, default: () => [] },
      disabled: Boolean,
    },
    emits: ['update:modelValue', 'change'],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          'div',
          { ...attrs, 'data-fbk-part': 'radio' },
          props.options.map((option) =>
            h('label', { 'data-radio-value': String(option.value) }, [
              h('input', {
                type: 'radio',
                value: option.value,
                checked: props.modelValue === option.value,
                disabled: props.disabled || option.disabled,
                onChange: () => {
                  emit('update:modelValue', option.value)
                  emit('change', option.value)
                },
              }),
              option.label,
            ]),
          ),
        )
    },
  })

  const Form = defineComponent({
    name: 'MockForm',
    // 声明 labelWidth / labelPosition 是为了让业务组件测试能断言「传了什么」。
    // 不声明的话它们落到 attrs，form.props() 读不到。
    props: {
      model: { type: Object, default: () => ({}) },
      labelWidth: { type: [String, Number], default: undefined },
      labelPosition: { type: String, default: undefined },
    },
    setup(_props, { expose, slots }) {
      expose({
        validate: async () => true as const,
        resetFields: () => {},
        clearValidate: () => {},
      })
      return () => h('form', { 'data-fbk-part': 'form' }, slots.default?.())
    },
  })

  const FormItem = defineComponent({
    name: 'MockFormItem',
    // rules / required / help 必须显式声明：不声明的话它们会落到 attrs，
    // 测试里 `props()` 读不到，于是「规则有没有真的传下来」无法断言。
    // 真实适配器（element-plus / naive-ui）都声明了这些 prop。
    props: {
      label: String,
      prop: String,
      required: Boolean,
      rules: { type: Array as PropType<any[]>, default: undefined },
      help: String,
    },
    setup(props, { slots }) {
      return () =>
        h('div', { 'data-fbk-part': 'form-item', 'data-prop': props.prop }, [
          props.label ? h('label', { 'data-fbk-part': 'form-label' }, props.label) : null,
          slots.default?.(),
        ])
    },
  })

  const DataGrid = defineComponent({
    name: 'MockDataGrid',
    inheritAttrs: false,
    props: {
      columns: { type: Array as PropType<DataGridColumn<any>[]>, default: () => [] },
      data: { type: Array as PropType<any[]>, default: () => [] },
      rowKey: { type: [String, Function], default: 'id' },
      selectionEnabled: Boolean,
      selectionWidth: { type: Number, default: 48 },
      selectedKeys: { type: Array as PropType<Array<string | number>>, default: () => [] },
      loading: Boolean,
      emptyText: String,
      loadMore: Boolean,
      finished: Boolean,
      },
    emits: ['update:selectedKeys', 'update:sort', 'row-click', 'load-more'],
    setup(props, { emit, slots }) {
      const keyOf = (row: any, index: number) =>
        typeof props.rowKey === 'function' ? props.rowKey(row) : (row[props.rowKey] ?? index)

      /* 排序状态完全由内部持有：契约里已经没有 sort 入参
         （它只在 element-plus 上被读过，naive/vant 忽略，等于受控排序在 2/3 适配器上不生效）。
         对外契约只剩 update:sort 事件，由 ProTable 据此发起请求。 */
      const innerSort = ref<SortState | null>(null)

      const fieldOf = (column: DataGridColumn<any>) => (column.dataIndex ?? column.key) as string

      const orderOf = (field: string): SortOrder =>
        innerSort.value?.field === field ? innerSort.value.order : null

      function toggleSort(field: string) {
        const current = innerSort.value
        const order: SortOrder =
          current?.field !== field
            ? 'asc'
            : current.order === 'asc'
              ? 'desc'
              : current.order === 'desc'
                ? null
                : 'asc'
        const next: SortState | null = order ? { field, order } : null
        innerSort.value = next
        emit('update:sort', next)
      }

      /* 三列形态与真实适配器一致：列标题 + 可排序列上的排序控件。
         未排序时显示 ↕，升序 ↑，降序 ↓ —— 用户靠它判断当前排序。 */
      const SORT_GLYPH: Record<'asc' | 'desc' | 'none', string> = { asc: '↑', desc: '↓', none: '↕' }

      return () =>
        h(
          'div',
          {
            'data-fbk-part': 'data-grid',
            'data-loading': String(props.loading),
            'data-selection-width': props.selectionEnabled ? String(props.selectionWidth) : undefined,
          },
          [
            /* 表头常驻：真实表格即便没有数据也渲染表头，
               排序控件因此永远是可达的，不会随空数据消失。 */
            h(
              'div',
              { 'data-fbk-part': 'grid-header' },
              props.columns.map((column) => {
                const field = fieldOf(column)
                const order = orderOf(field)
                return h(
                  'div',
                  { 'data-fbk-part': 'header-cell', 'data-column': column.key },
                  [
                    h('span', { 'data-fbk-part': 'header-title' }, column.title),
                    column.sortable
                      ? h(
                          'button',
                          {
                            type: 'button',
                            'data-fbk-part': 'sort-trigger',
                            'data-sort-order': order ?? 'none',
                            onClick: () => toggleSort(field),
                          },
                          SORT_GLYPH[order ?? 'none'],
                        )
                      : null,
                  ],
                )
              }),
            ),
            props.data.length === 0
              /* 契约里 empty 是插槽：传了就用业务内容，没传才渲染默认空态。
                 mock 必须和真实适配器同一语义，否则「CrudPage 有没有转发 empty」
                 这类问题在测试里永远看不见。 */
              ? h(
                  'div',
                  { 'data-fbk-part': 'empty' },
                  slots.empty ? slots.empty() : (props.emptyText ?? '暂无数据'),
                )
              : props.data.map((row, index) => {
                const cells = props.columns.map((column) => {
                  const key = (column.dataIndex ?? column.key) as string
                  const value = row[key]
                  return h(
                    'div',
                    { 'data-fbk-part': 'cell', 'data-column': column.key },
                    column.render
                      ? (column.render({ row, index, column, value }) as any)
                      : String(value ?? '-'),
                  )
                })
                return h(
                  'div',
                  {
                    'data-fbk-part': 'grid-row',
                    'data-row-key': String(keyOf(row, index)),
                    onClick: (event: Event) => emit('row-click', row, index, event),
                  },
                  [
                    props.selectionEnabled
                      ? h('input', {
                          type: 'checkbox',
                          'data-fbk-part': 'selection',
                          checked: props.selectedKeys.includes(keyOf(row, index)),
                          onClick: (event: Event) => event.stopPropagation(),
                          onChange: (event: Event) => {
                            const checked = (event.target as HTMLInputElement).checked
                            const key = keyOf(row, index)
                            const next = new Set(props.selectedKeys)
                            if (checked) next.add(key)
                            else next.delete(key)
                            emit('update:selectedKeys', [...next])
                          },
                        })
                      : null,
                    ...cells,
                  ],
                )
              }),
          ],
        )
    },
  })

  const Pagination = defineComponent({
    name: 'MockPagination',
    props: {
      page: { type: Number, default: 1 },
      pageSize: { type: Number, default: 20 },
      total: { type: Number, default: 0 },
    },
    emits: ['update:page', 'update:pageSize'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-fbk-part': 'pagination', 'data-page': props.page }, [
          h('button', { 'data-fbk-part': 'prev', onClick: () => emit('update:page', props.page - 1) }, 'prev'),
          h('span', `${props.page}/${Math.ceil(props.total / props.pageSize) || 1}`),
          h('button', { 'data-fbk-part': 'next', onClick: () => emit('update:page', props.page + 1) }, 'next'),
        ])
    },
  })

  const Dialog = defineComponent({
    name: 'MockDialog',
    props: {
      modelValue: Boolean,
      title: String,
      width: [String, Number],
      placement: String,
      closeOnClickModal: Boolean,
      showClose: Boolean,
    },
    emits: ['update:modelValue', 'close'],
    setup(props, { slots }) {
      /* 必须渲染 footer 插槽：真实适配器（element-plus / naive / vant）
         都有 footer 区域，业务组件（如 FormModal）靠它放操作按钮。
         早期 mock 只渲染 default，导致「弹窗里有没有按钮」根本没法断言。 */
      return () =>
        props.modelValue
          ? h('div', { 'data-fbk-part': 'dialog', 'data-title': props.title }, [
              h('div', { 'data-fbk-part': 'dialog-body' }, slots.default?.()),
              slots.footer
                ? h('div', { 'data-fbk-part': 'dialog-footer' }, slots.footer())
                : null,
            ])
          : null
    },
  })

  /* Drawer 从契约版本 3 起是必填原语：少了它，用 mock 的装配路径会被
     assertAdapterCompatible 当成旧适配器拦下。形状与真实适配器对齐 ——
     标题栏、关闭控件、默认插槽，关闭时发出 update:modelValue(false)。 */
  const Drawer = defineComponent({
    name: 'MockDrawer',
    props: {
      modelValue: Boolean,
      title: String,
      width: [String, Number],
      placement: String,
      closeOnClickModal: Boolean,
      showClose: Boolean,
    },
    emits: ['update:modelValue', 'close'],
    setup(props, { emit, slots }) {
      return () =>
        props.modelValue
          ? h(
              'div',
              {
                'data-fbk-part': 'drawer',
                'data-title': props.title,
                'data-placement': props.placement,
              },
              [
                h('div', { 'data-fbk-part': 'drawer-header' }, [
                  h('span', { 'data-fbk-part': 'drawer-title' }, props.title),
                  props.showClose === false
                    ? null
                    : h(
                        'button',
                        {
                          type: 'button',
                          'data-fbk-part': 'drawer-close',
                          onClick: () => emit('update:modelValue', false),
                        },
                        '×',
                      ),
                ]),
                h('div', { 'data-fbk-part': 'drawer-body' }, slots.default?.()),
                slots.footer ? h('div', { 'data-fbk-part': 'drawer-footer' }, slots.footer()) : null,
              ],
            )
          : null
    },
  })

  const Tag = defineComponent({
    name: 'MockTag',
    props: { status: String },
    setup(props, { slots }) {
      return () => h('span', { 'data-fbk-part': 'tag', 'data-status': props.status }, slots.default?.())
    },
  })

  const Spin = defineComponent({
    name: 'MockSpin',
    props: { loading: Boolean, description: String },
    setup(props, { slots }) {
      return () =>
        h('div', { 'data-fbk-part': 'spin', 'data-loading': String(props.loading) }, slots.default?.())
    },
  })

  return { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Drawer, Tag, Spin }
}

export interface MockFeedbackRecord {
  type: MessageType
  content: string
  options?: MessageOptions
}

/** 测试用 feedback：把调用记录下来，业务侧代码照常写，测试里断言即可 */
export function createMockFeedback() {
  const messages: MockFeedbackRecord[] = []
  const confirms: Array<{ content: string; options?: ConfirmOptions }> = []
  /** 下一次 confirm 的返回值，测试里可改 */
  const state = { confirmResult: true }

  const show = (type: MessageType, content: string, options?: MessageOptions) => {
    messages.push({ type, content, options })
    return () => {}
  }

  const message = ((type: MessageType, content: string, options?: MessageOptions) =>
    show(type, content, options)) as MessageApi
  message.success = (c, o) => show('success', c, o)
  message.warning = (c, o) => show('warning', c, o)
  message.error = (c, o) => show('error', c, o)
  message.info = (c, o) => show('info', c, o)

  const confirm = async (content: string, options?: ConfirmOptions) => {
    confirms.push({ content, options })
    return state.confirmResult
  }

  return { api: { message, confirm } as FeedbackApi, messages, confirms, state }
}

export function createMockAdapter(overrides?: DeepPartial<Capabilities>): UiAdapter {
  return {
    meta: {
      // 必须与 core 契约同版本：mock 代表一个真实适配器，版本落后会让
      // 任何经 assertAdapterCompatible 的装配路径在测试里抛错，测试基座反而不像真实环境。
      apiVersion: ADAPTER_API_VERSION,
      name: 'mock',
      version: '0.0.0',
      uiLibrary: { name: 'mock', version: '0.0.0' },
      platform: 'desktop',
    },
    capabilities: mergeCapabilities(defaultMockCapabilities, overrides),
    // 测试用 feedback：记录调用而不真正弹窗，便于断言
    feedback: createMockFeedback().api,
    primitives: createMockPrimitives(),
    RootProvider: defineComponent({
      name: 'MockRootProvider',
      setup(_props, { slots }) {
        return () => h('div', { 'data-fbk-part': 'provider' }, slots.default?.())
      },
    }),
    theme: {
      apply: () => {},
      providerProps: () => ({}),
    },
  }
}
