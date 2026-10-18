import { computed, reactive, watch } from 'vue'
import type { QueryField } from './types'

export function useQueryModel(options: {
  fields: () => QueryField[]
  modelValue: () => Record<string, any> | undefined
  defaultValues: () => Record<string, any> | undefined
  onChange?: (values: Record<string, any>) => void
}) {
  const controlled = computed(() => options.modelValue() !== undefined)

  function buildInitial(): Record<string, any> {
    if (controlled.value) return { ...(options.modelValue() ?? {}) }
    const base = { ...(options.defaultValues() ?? {}) }
    for (const field of options.fields()) {
      if (!(field.name in base) && field.defaultValue !== undefined) {
        base[field.name] = field.defaultValue
      }
    }
    return base
  }

  const inner = reactive<Record<string, any>>(buildInitial())

  const values = computed<Record<string, any>>(() =>
    controlled.value ? (options.modelValue() ?? {}) : inner,
  )

  function setValue(name: string, value: unknown) {
    if (!controlled.value) inner[name] = value
    options.onChange?.({ ...values.value, [name]: value })
  }

  function setValues(next: Record<string, any>) {
    if (!controlled.value) {
      for (const key of Object.keys(inner)) delete inner[key]
      Object.assign(inner, next)
    }
    options.onChange?.({ ...next })
  }

  function reset() {
    const initial = { ...(options.defaultValues() ?? {}) }
    for (const field of options.fields()) {
      if (!(field.name in initial) && field.defaultValue !== undefined) {
        initial[field.name] = field.defaultValue
      }
    }
    setValues(initial)
    return initial
  }

  // 受控模式下外部值变化直接生效；非受控模式不需要同步
  watch(
    () => options.modelValue(),
    (value) => {
      if (value === undefined) return
      for (const key of Object.keys(inner)) delete inner[key]
      Object.assign(inner, value)
    },
    { deep: true },
  )

  return { values, setValue, setValues, reset }
}
