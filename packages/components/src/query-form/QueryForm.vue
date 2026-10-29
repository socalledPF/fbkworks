<script setup lang="ts">
import { computed, h, ref, useAttrs, useSlots } from 'vue'
import type { Slots } from 'vue'
import { useAdapter } from '@fbkworks/adapter-core'
import type { SelectOption } from '@fbkworks/adapter-core'
import { resolveColumns, warnOnce } from '@fbkworks/shared'
import type { QueryField, QueryFormExpose, QueryFormProps } from './types'
import { useQueryModel } from './use-query-model'

defineOptions({ name: 'FbkQueryForm', inheritAttrs: false })

const props = withDefaults(defineProps<QueryFormProps>(), {
  modelValue: undefined,
  defaultValues: undefined,
  columns: 3,
  collapsible: true,
  defaultCollapsed: true,
  visibleCount: undefined,
  submitText: '查询',
  resetText: '重置',
  loading: false,
  labelWidth: undefined,
  uiProps: undefined,
})

const attrs = useAttrs()

const emit = defineEmits<{
  'update:modelValue': [values: Record<string, any>]
  submit: [values: Record<string, any>]
  reset: [values: Record<string, any>]
  change: [values: Record<string, any>]
}>()

const adapter = useAdapter()
const slots: Slots = useSlots()
const { Form, FormItem, Input, Select, Checkbox, DatePicker, Radio, Button } = adapter.primitives

const formRef = ref<any>()
const collapsed = ref(props.defaultCollapsed)

const { values, setValue, setValues, reset } = useQueryModel({
  fields: () => props.fields,
  modelValue: () => props.modelValue,
  defaultValues: () => props.defaultValues,
  onChange: (next) => {
    emit('update:modelValue', next)
    emit('change', next)
  },
})

const visibleFields = computed(() =>
  props.fields.filter((field) =>
    typeof field.hidden === 'function' ? !field.hidden(values.value) : !field.hidden,
  ),
)

const limit = computed(() => props.visibleCount ?? (typeof props.columns === 'number' ? props.columns * 2 : 4))

const renderedFields = computed<QueryField[]>(() =>
  collapsed.value && props.collapsible ? visibleFields.value.slice(0, limit.value) : visibleFields.value,
)

const canCollapse = computed(() => props.collapsible && visibleFields.value.length > limit.value)

/**
 * 列数展开成 --fbk-cols-* 变量，由样式表按断点取值。
 *
 * 之前这里写的是 --fbk-query-form-responsive，但**没有任何样式消费它**，
 * 于是 columns={{ xs: 1, md: 3 }} 静默无效（不报错、不生效）。
 */
const gridStyle = computed(() => resolveColumns(props.columns))

function renderControl(field: QueryField) {
  const value = values.value[field.name]
  const update = (next: unknown) => setValue(field.name, next)
  const common = { disabled: props.loading, ...(field.uiProps ?? {}) }

  const customRender = field.render
  if (customRender) {
    return customRender({ value, values: values.value, setValue: (next) => update(next) })
  }

  switch (field.type) {
    case 'input':
    case 'textarea':
    case 'number':
      return h(Input, {
        ...common,
        type: field.type,
        modelValue: value ?? '',
        placeholder: field.placeholder ?? `请输入${field.label}`,
        'onUpdate:modelValue': update,
      })
    case 'select':
      return h(Select, {
        ...common,
        modelValue: value ?? undefined,
        options: (field.options ?? []) as SelectOption[],
        placeholder: field.placeholder ?? `请选择${field.label}`,
        'onUpdate:modelValue': update,
      })
    case 'switch':
    case 'checkbox':
      /* 走适配器的 Checkbox 原语。原先这里是裸的 <input type="checkbox">，
         三个适配器下会长出三种样子，等于绕过了适配层。 */
      return h(Checkbox, {
        ...common,
        modelValue: Boolean(value),
        'onUpdate:modelValue': update,
      })
    case 'date':
    case 'date-range':
      /* 走适配器的 DatePicker 原语。
         此前这两个类型落进 default，被渲染成普通文本框 ——
         筛选条件写 type: 'date' 得到的却是个能随便输入的框。 */
      return h(DatePicker, {
        ...common,
        type: field.type === 'date-range' ? 'daterange' : 'date',
        modelValue: value ?? null,
        placeholder: field.placeholder ?? `请选择${field.label}`,
        'onUpdate:modelValue': update,
      })
    case 'radio':
      return h(Radio, {
        ...common,
        modelValue: value ?? null,
        options: (field.options ?? []) as SelectOption[],
        'onUpdate:modelValue': update,
      })
    case 'custom':
      return null
    default:
      /* 剩余类型（time 等）降级为文本框，但不再静默 */
      warnOnce(
        `query-field-type:${field.type}`,
        `查询字段类型 "${field.type}" 尚未实现，已降级为文本输入框。`,
      )
      return h(Input, {
        ...common,
        modelValue: value ?? '',
        placeholder: field.placeholder ?? field.label,
        'onUpdate:modelValue': update,
      })
  }
}

function collect() {
  return { ...values.value }
}

/** 功能性包装，避免在模板里用 :is 直接渲染 VNode。 */
const FieldControl = (controlProps: { field: QueryField }) => renderControl(controlProps.field)
FieldControl.props = ['field']

function submit() {
  emit('submit', collect())
}

function onReset() {
  const next = reset()
  emit('reset', { ...next })
}

async function validate() {
  return (await formRef.value?.validate?.()) ?? (true as const)
}

function getValues() {
  return collect()
}

defineExpose<QueryFormExpose>({ submit, reset: onReset, validate, getValues, setValues })

const formProps = computed(() => ({
  ...(props.uiProps?.form ?? {}),
  model: values.value,
  /* 默认 'auto'：标签按最宽的那个统一，控件左边缘才对得齐。
     不传的话 element-plus / naive-ui 会让标签按内容收缩，
     「状态」下的输入框就比「负责人」下的宽 14px（实测 327 vs 313）。 */
  labelWidth: props.labelWidth ?? 'auto',
  labelPosition: 'right' as const,
}))
</script>

<template>
  <div class="fbk-query-form" v-bind="attrs" :style="gridStyle">
    <component :is="Form" ref="formRef" v-bind="formProps">
      <div class="fbk-query-form__grid">
        <component
          :is="FormItem"
          v-for="field in renderedFields"
          :key="field.name"
          :label="field.label"
          :prop="field.name"
          :rules="field.rules"
          :span="field.span"
        >
          <slot v-if="slots[`field-${field.name}`]" :name="`field-${field.name}`" :value="values[field.name]" :set-value="(v: any) => setValue(field.name, v)" :values="values" />
          <div v-else class="fbk-query-form__control">
            <FieldControl :field="field" />
          </div>
        </component>
      </div>

      <div class="fbk-query-form__actions" v-bind="uiProps?.actions">
        <slot name="before-actions" />
        <component :is="Button" variant="primary" :loading="loading" @click="submit">
          {{ submitText }}
        </component>
        <component :is="Button" @click="onReset">{{ resetText }}</component>
        <component :is="Button" v-if="canCollapse" variant="text" @click="collapsed = !collapsed">
          {{ collapsed ? '展开' : '收起' }}
        </component>
        <slot name="after-actions" />
        <slot name="actions" />
      </div>
    </component>
  </div>
</template>
