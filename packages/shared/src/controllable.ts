import { computed, ref, type ComputedRef, type Ref } from 'vue'

export interface ControllableOptions<T> {
  /** 读取外部传入的受控值；返回 undefined 表示非受控 */
  value: () => T | undefined
  /** 非受控模式下的初始值 */
  defaultValue: T
  /** 每次变更都会触发（受控与非受控都会） */
  onChange?: (value: T) => void
}

/**
 * 存在即受控：外部传入非 undefined 值时使用外部值，否则使用内部状态。
 * 组件统一通过它实现 `v-model`，避免“有时受控有时不受控”的歧义。
 */
export function useControllableState<T>(
  options: ControllableOptions<T>,
): [ComputedRef<T>, (value: T) => void] {
  const inner = ref(options.defaultValue) as Ref<T>
  const controlled = computed(() => options.value() !== undefined)
  const state = computed(() => (controlled.value ? (options.value() as T) : inner.value))

  const setState = (value: T) => {
    if (!controlled.value) inner.value = value
    options.onChange?.(value)
  }

  return [state, setState]
}
