import { computed, defineComponent, ref, type PropType } from 'vue'
import { Field, Popup, Picker, Checkbox, CheckboxGroup, Cell } from 'vant'
import type { SelectOption, SelectProps } from '@fbkworks/adapter-core'

/**
 * vant 没有 select：用 只读 Field + Popup + Picker（单选）/ CheckboxGroup（多选）组合。
 * 业务侧只传 options + modelValue —— 这正是适配层存在的意义。
 */
export const Select = defineComponent({
  name: 'FbkVantSelect',
  inheritAttrs: false,
  props: {
    modelValue: { type: [String, Number, Array] as PropType<SelectProps['modelValue']>, default: undefined },
    options: { type: Array as PropType<SelectOption[]>, default: () => [] },
    multiple: Boolean,
    filterable: Boolean,
    clearable: { type: Boolean, default: true },
    placeholder: String,
    title: String,
    size: String,
    disabled: Boolean,
    loading: Boolean,
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { attrs, emit }) {
    const show = ref(false)
    const tempValue = ref<unknown>(props.modelValue)

    const selectedLabels = computed(() => {
      const values = Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]
      return props.options
        .filter((option) => values.includes(option.value))
        .map((option) => option.label)
        .join(', ')
    })

    /* 必须是**完整** options，不能是过滤后的子集。
       vant 的 Picker 在 columns 变化时会 resetSelectedValues：当前值不在新列里就改成第一项，
       列变空则 confirm 出 undefined。用 filteredOptions 喂它意味着「用户只是搜了一下」
       就会静默改写甚至清空已选值（实测可复现：选中「南京」，搜「杭」，点确定 → 变成 hz）。
       过滤只作用于多选分支的 Checkbox 列表（那里没有 Picker 的这层语义）。 */
    const pickerColumns = computed(() =>
      props.options.map((option) => ({ text: option.label, value: option.value })),
    )

    const open = () => {
      if (props.disabled || props.loading) return
      tempValue.value = props.modelValue
      resetKeyword()
      show.value = true
    }

    const confirmSingle = ({ selectedOptions }: { selectedOptions: Array<{ value: unknown }> }) => {
      const value = selectedOptions[0]?.value
      emit('update:modelValue', value)
      emit('change', value)
      show.value = false
    }

    const confirmMultiple = () => {
      emit('update:modelValue', tempValue.value)
      emit('change', tempValue.value)
      show.value = false
    }

    /* filterable / clearable 以前只声明不读取（渲染体里零引用）。
       这里就地实现：关键字过滤 + 一个自绘的清除按钮。
       不用 Field 自带的 clearable —— vant 只在**可编辑**时显示那个图标，
       而我们的 Field 是 readonly（只读展示 + 弹层选择）。 */
    const keyword = ref('')
    /* 关闭后清空搜索词：否则下次打开还停在上次的过滤结果里，用户不知道自己在看子集。 */
    function resetKeyword() {
      keyword.value = ''
    }
    const filteredOptions = computed(() => {
      const key = keyword.value.trim().toLowerCase()
      if (!key) return props.options
      return props.options.filter((option) => option.label.toLowerCase().includes(key))
    })
    const hasValue = computed(() =>
      Array.isArray(props.modelValue)
        ? props.modelValue.length > 0
        : props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '',
    )
    const showClear = computed(
      () => Boolean(props.clearable) && hasValue.value && !props.disabled && !props.loading,
    )
    function clear() {
      const empty = props.multiple ? [] : undefined
      emit('update:modelValue', empty as any)
      emit('change', empty as any)
    }

    return () => (
      <div class="fbk-vant-select" {...attrs}>
        <Field
          readonly
          isLink
          modelValue={selectedLabels.value}
          placeholder={props.placeholder ?? '请选择'}
          /* loading 期间同样不可交互：element-plus / naive-ui 都是 disabled={disabled || loading}，
             以前 vant 只认 disabled，于是「加载中还能拉开一个空列表再选」。
             另外把 loading 传给 Field，vant 会在右侧显示 loading 图标。 */
          disabled={props.disabled || props.loading}
          onClick={() => {
            if (props.disabled || props.loading) return
            open()
          }}
        />
        {showClear.value ? (
          <button
            type="button"
            class="fbk-vant-select__clear"
            aria-label="清除"
            onClick={(event: Event) => {
              event.stopPropagation()
              clear()
            }}
          >
            ×
          </button>
        ) : null}
        <Popup v-model:show={show.value} position="bottom" round teleport="body">
          {props.filterable ? (
            <div class="fbk-vant-select__search">
              <Field v-model={keyword.value} placeholder="搜索" clearable />
            </div>
          ) : null}
          {props.multiple ? (
            <div class="fbk-vant-select__multiple">
              <Cell title={props.title ?? '请选择'} />
              <CheckboxGroup modelValue={tempValue.value as any[]} onUpdate:modelValue={(value: any[]) => (tempValue.value = value)}>
                {filteredOptions.value.map((option) => (
                  <Cell key={String(option.value)} title={option.label}>
                    {{
                      rightIcon: () => (
                        <Checkbox name={option.value} disabled={option.disabled} shape="square" />
                      ),
                    }}
                  </Cell>
                ))}
              </CheckboxGroup>
              <div class="fbk-vant-select__actions">
                <button type="button" onClick={confirmMultiple}>
                  确定
                </button>
              </div>
            </div>
          ) : (
            <Picker
              title={props.title ?? '请选择'}
              columns={pickerColumns.value}
              modelValue={tempValue.value as any}
              onConfirm={confirmSingle}
              onCancel={() => (show.value = false)}
            />
          )}
        </Popup>
      </div>
    )
  },
})
