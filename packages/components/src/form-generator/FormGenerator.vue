<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, h, ref, useSlots } from 'vue'
import type { Slots } from 'vue'
import { useAdapter } from '@fbk/adapter-core'
import type { SelectOption } from '@fbk/adapter-core'
import { resolveColumns } from '@fbk/shared'
import type { FormField, FormGeneratorExpose, FormGeneratorProps } from './types'
import type { QueryField } from '../query-form/types'
import { useQueryModel } from '../query-form/use-query-model'

defineOptions({ name: 'FbkFormGenerator', inheritAttrs: false })

const props = withDefaults(defineProps<FormGeneratorProps<T>>(), {
  modelValue: undefined,
  defaultValues: undefined,
  mode: 'edit',
  disabled: false,
  loading: false,
  showActions: true,
  submitText: '提交',
  resetText: '重置',
  uiProps: undefined,
})

const emit = defineEmits<{
  'update:modelValue': [values: Record<string, any>]
  submit: [values: Record<string, any>]
  reset: [values: Record<string, any>]
  change: [values: Record<string, any>]
}>()

const adapter = useAdapter()
const slots: Slots = useSlots()
const { Form, FormItem, Input, Select, Button } = adapter.primitives

const formRef = ref<any>()

const { values, setValue, setValues, reset } = useQueryModel({
  fields: () => props.schema.fields as unknown as QueryField[],
  modelValue: () => props.modelValue as Record<string, any> | undefined,
  defaultValues: () => props.defaultValues as Record<string, any> | undefined,
  onChange: (next) => {
    emit('update:modelValue', next)
    emit('change', next)
  },
})

const isView = computed(() => props.mode === 'view')
const isDisabled = computed(() => props.disabled || isView.value)

const fieldMap = computed(() => new Map(props.schema.fields.map((field) => [field.name, field])))

const visibleFields = computed(() =>
  props.schema.fields.filter((field) =>
    typeof field.hidden === 'function' ? !field.hidden(values.value) : !field.hidden,
  ),
)

interface RenderedGroup {
  title?: string
  fields: FormField[]
}

const renderedGroups = computed<RenderedGroup[]>(() => {
  if (!props.schema.groups?.length) {
    return [{ title: undefined, fields: visibleFields.value }]
  }
  return props.schema.groups.map((group) => ({
    title: group.title,
    fields: group.fields
      .map((name) => fieldMap.value.get(name))
      .filter((field): field is FormField => Boolean(field) && visibleFields.value.includes(field as FormField)),
  }))
})

/** 之前对象形式被整个丢弃、回退成 1，schema.columns={{ md: 3 }} 静默无效。 */
const gridStyle = computed(() => resolveColumns(props.schema.columns))

function isFieldDisabled(field: FormField) {
  if (isDisabled.value) return true
  if (typeof field.disabled === 'function') return field.disabled(values.value)
  return Boolean(field.disabled)
}

function renderControl(field: FormField) {
  const value = values.value[field.name]
  const update = (next: unknown) => setValue(field.name, next)
  const disabled = isFieldDisabled(field)
  const common = { disabled, ...(field.uiProps ?? {}) }

  if (isView.value) {
    const display =
      field.type === 'select' && field.options
        ? (field.options.find((option: SelectOption) => option.value === value)?.label ?? '-')
        : value === null || value === undefined || value === ''
          ? '-'
          : String(value)
    return h('span', { class: 'fbk-form-generator__view' }, display)
  }

  if (field.render) {
    return field.render({ value, values: values.value, setValue: update })
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
      return h('input', {
        type: 'checkbox',
        disabled,
        checked: Boolean(value),
        onChange: (event: Event) => update((event.target as HTMLInputElement).checked),
      })
    default:
      return h(Input, {
        ...common,
        modelValue: value ?? '',
        placeholder: field.placeholder ?? field.label,
        'onUpdate:modelValue': update,
      })
  }
}

const FieldControl = (controlProps: { field: FormField }) => renderControl(controlProps.field)
FieldControl.props = ['field']

const rules = computed(() => {
  const result: Record<string, any> = { ...(props.schema.rules ?? {}) }
  for (const field of props.schema.fields) {
    if (field.required) {
      result[field.name] = [{ required: true, message: `${field.label}不能为空` }, ...(result[field.name] ?? [])]
    }
    if (field.rules?.length) {
      result[field.name] = [...(result[field.name] ?? []), ...field.rules]
    }
  }
  return result
})

const formProps = computed(() => ({
  ...(props.uiProps ?? {}),
  model: values.value,
  rules: rules.value,
  // 同 QueryForm：默认按最宽标签统一，避免控件左边缘参差
  labelWidth: props.schema.labelWidth ?? 'auto',
  labelPosition: props.schema.labelPosition ?? 'right',
  disabled: isDisabled.value,
}))

async function validate() {
  return (await formRef.value?.validate?.()) ?? (true as const)
}

function resetFields() {
  const next = reset()
  emit('reset', { ...next })
}

function submit() {
  emit('submit', { ...values.value })
}

function getValues() {
  return { ...values.value }
}

defineExpose<FormGeneratorExpose>({
  validate,
  validateField: (prop) => formRef.value?.validateField?.(prop) ?? Promise.resolve(true),
  resetFields,
  getValues,
  setValues,
  submit,
})
</script>

<template>
  <div class="fbk-form-generator" :style="gridStyle">
    <component :is="Form" ref="formRef" v-bind="formProps">
      <section v-for="(group, groupIndex) in renderedGroups" :key="groupIndex" class="fbk-form-generator__group">
        <h3 v-if="group.title" class="fbk-form-generator__group-title">{{ group.title }}</h3>
        <div class="fbk-form-generator__grid">
          <component
            :is="FormItem"
            v-for="field in group.fields"
            :key="field.name"
            :label="field.label"
            :prop="field.name"
            :required="field.required"
            :help="field.help"
            :span="field.span"
          >
            <slot v-if="slots[`field-${field.name}`]" :name="`field-${field.name}`" :value="values[field.name]" :set-value="(v: any) => setValue(field.name, v)" :values="values" />
            <FieldControl v-else :field="field" />
          </component>
        </div>
      </section>

      <div v-if="showActions && !isView" class="fbk-form-generator__actions">
        <component :is="Button" variant="primary" :loading="loading" @click="submit">{{ submitText }}</component>
        <component :is="Button" @click="resetFields">{{ resetText }}</component>
        <slot name="actions" />
      </div>
    </component>
  </div>
</template>
