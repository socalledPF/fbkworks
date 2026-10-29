<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, h, ref, useAttrs, useSlots } from 'vue'
import type { Slots } from 'vue'
import { useAdapter } from '@fbkworks/adapter-core'
import type { SelectOption } from '@fbkworks/adapter-core'
import { resolveColumns, warnOnce } from '@fbkworks/shared'
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

const { values, setValue, setValues, reset } = useQueryModel({
  fields: () => props.schema.fields as unknown as QueryField[],
  modelValue: () => props.modelValue as Record<string, any> | undefined,
  defaultValues: () => props.defaultValues as Record<string, any> | undefined,
  onChange: (next) => {
    emit('update:modelValue', next)
    emit('change', next)
  },
})

/**
 * 解析字段的 options。
 *
 * 支持两种形态：
 *   静态   options: [{ label, value }]
 *   动态   options: (values) => [{ label, value }]
 *
 * 动态形式用于联动：选了省份后城市选项变化。
 */
function resolveOptions(field: FormField): SelectOption[] {
  const raw = field.options
  if (!raw) return []
  if (typeof raw === 'function') {
    try {
      return raw(values.value)
    } catch {
      /* 解析函数抛错不该让整个表单崩 —— 退化成空选项，
         用户看到「无选项」比白屏好排查。 */
      return []
    }
  }
  return raw
}

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
  // disabled 放在 uiProps 之前，让 field.uiProps.disabled 能显式覆盖计算结果
  const common = { disabled, ...(field.uiProps ?? {}) }

  if (isView.value) {
    const display =
      field.type === 'select' && field.options
        ? (resolveOptions(field).find((option: SelectOption) => option.value === value)?.label ?? '-')
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
        options: resolveOptions(field),
        placeholder: field.placeholder ?? `请选择${field.label}`,
        'onUpdate:modelValue': update,
      })
    case 'switch':
    case 'checkbox':
      /* 走适配器的 Checkbox 原语，不用裸 <input>：
         原先的写法在三个适配器下会长出三种样子，而且丢了 size/label 的对齐。 */
      return h(Checkbox, {
        ...common,
        modelValue: Boolean(value),
        'onUpdate:modelValue': update,
      })
    case 'date':
    case 'datetime':
    case 'time':
    case 'date-range':
      /* 走适配器的 DatePicker 原语。
         这些类型此前全部落进 default，被渲染成普通文本框 ——
         用户看到一个能随便输入的框，以为"支持日期"。 */
      return h(DatePicker, {
        ...common,
        type: field.type === 'date-range' ? 'daterange' : field.type,
        modelValue: value ?? null,
        placeholder: field.placeholder ?? `请选择${field.label}`,
        'onUpdate:modelValue': update,
      })
    case 'radio':
      return h(Radio, {
        ...common,
        modelValue: value ?? null,
        options: resolveOptions(field),
        'onUpdate:modelValue': update,
      })
    default:
      /* 剩下的 rate / slider / upload 仍是降级为文本框，但不再是静默的：
         warnOnce 会提示一次，避免业务方以为这些类型已经支持。 */
      warnOnce(
        `field-type:${field.type}`,
        `字段类型 "${field.type}" 尚未实现，已降级为文本输入框。` +
          '可用的类型见 FormGenerator 文档，或改用 field.render 自定义。',
      )
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

/**
 * 按字段聚合校验规则：schema 级 + 字段级 required + 字段级 rules。
 *
 * 注意这个结果同时喂给两处：
 *   · `<Form :rules>` —— 表单整体校验
 *   · `<FormItem :rules>` —— 单条目的即时反馈
 * 只喂第一处的话，UI 库仍能校验，但行内不会出现红框与提示文案；
 * 只喂第二处则 `validate()` 拿不到规则。两处都要。
 */
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

/**
 * 传给单个 FormItem 的规则。
 * 没有规则时返回 undefined 而不是 []：空数组会让 UI 库仍然挂上校验分支，
 * 产生无意义的 watch 与 render 开销。
 */
function rulesOf(name: string) {
  const list = rules.value[name]
  return list?.length ? list : undefined
}

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
  <div class="fbk-form-generator" v-bind="attrs" :style="gridStyle">
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
            :rules="rulesOf(field.name)"
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
