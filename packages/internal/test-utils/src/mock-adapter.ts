import { defineComponent, h, type PropType } from 'vue'
import type { Capabilities, DataGridColumn, UiAdapter, UiPrimitives } from '@fbk/adapter-core'

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
  feedback: { message: true, notification: true, confirm: true, loading: true },
  theme: { darkMode: true, cssVariables: true, provider: false },
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
      presentation: { type: String, default: 'auto' },
      loading: Boolean,
      emptyText: String,
      loadMore: Boolean,
      finished: Boolean,
    },
    emits: ['update:selectedKeys', 'update:sort', 'row-click', 'load-more'],
    setup(props, { emit }) {
      const keyOf = (row: any, index: number) =>
        typeof props.rowKey === 'function' ? props.rowKey(row) : (row[props.rowKey] ?? index)

      return () =>
        h(
          'div',
          {
            'data-fbk-part': 'data-grid',
            'data-presentation': props.presentation,
            'data-loading': String(props.loading),
            'data-selection-width': props.selectionEnabled ? String(props.selectionWidth) : undefined,
          },
          props.data.length === 0
            ? h('div', { 'data-fbk-part': 'empty' }, props.emptyText ?? '暂无数据')
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
    props: { modelValue: Boolean, title: String },
    emits: ['update:modelValue'],
    setup(props, { slots }) {
      return () =>
        props.modelValue
          ? h('div', { 'data-fbk-part': 'dialog', 'data-title': props.title }, slots.default?.())
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

  const Empty = defineComponent({
    name: 'MockEmpty',
    props: { description: String },
    setup(props) {
      return () => h('div', { 'data-fbk-part': 'empty' }, props.description ?? '暂无数据')
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

  return { Button, Input, Select, Checkbox, DatePicker, Radio, Form, FormItem, DataGrid, Pagination, Dialog, Tag, Empty, Spin }
}

export function createMockAdapter(overrides?: DeepPartial<Capabilities>): UiAdapter {
  return {
    meta: {
      apiVersion: 1,
      name: 'mock',
      version: '0.0.0',
      uiLibrary: { name: 'mock', version: '0.0.0' },
      platform: 'desktop',
    },
    capabilities: mergeCapabilities(defaultMockCapabilities, overrides),
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
