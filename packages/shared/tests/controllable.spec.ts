import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useControllableState } from '../src/controllable'

/**
 * 存在即受控：传值即受控，不传则用内部状态。
 * 组件统一通过它实现 v-model，避免"有时受控有时不受控"的歧义。
 */
describe('useControllableState', () => {
  it('非受控：内部状态可写', () => {
    const [state, setState] = useControllableState({ value: () => undefined, defaultValue: 1 })
    expect(state.value).toBe(1)
    setState(2)
    expect(state.value).toBe(2)
  })

  it('受控：读外部值，写入不改变呈现', () => {
    const external = ref<number | undefined>(5)
    const [state, setState] = useControllableState({
      value: () => external.value,
      defaultValue: 0,
    })
    expect(state.value).toBe(5)

    setState(9)
    // 受控模式下内部不存值，呈现仍跟随外部
    expect(state.value).toBe(5)
  })

  it('受控：外部值变化立即反映', async () => {
    const external = ref<number | undefined>(1)
    const [state] = useControllableState({ value: () => external.value, defaultValue: 0 })
    external.value = 3
    await nextTick()
    expect(state.value).toBe(3)
  })

  it('onChange 在受控与非受控下都会触发', () => {
    const seen: number[] = []
    const [state, setState] = useControllableState({
      value: () => undefined,
      defaultValue: 0,
      onChange: (v) => seen.push(v),
    })
    setState(1)
    setState(2)
    expect(seen).toEqual([1, 2])
    expect(state.value).toBe(2)
  })

  it('fromComputed 形式：受控判定跟随源的响应性', async () => {
    const external = ref<number | undefined>(undefined)
    const [state, setState] = useControllableState({
      value: () => external.value,
      defaultValue: 0,
    })
    setState(1)
    expect(state.value).toBe(1)

    // 外部开始接管
    external.value = 7
    await nextTick()
    expect(state.value).toBe(7)
  })
})
