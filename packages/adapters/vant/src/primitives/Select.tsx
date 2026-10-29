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

    const pickerColumns = computed(() =>
      props.options.map((option) => ({ text: option.label, value: option.value })),
    )

    const open = () => {
      if (props.disabled) return
      tempValue.value = props.modelValue
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

    return () => (
      <div class="fbk-vant-select" {...attrs}>
        <Field
          readonly
          isLink
          modelValue={selectedLabels.value}
          placeholder={props.placeholder ?? '请选择'}
          disabled={props.disabled}
          onClick={open}
        />
        <Popup v-model:show={show.value} position="bottom" round teleport="body">
          {props.multiple ? (
            <div class="fbk-vant-select__multiple">
              <Cell title={props.title ?? '请选择'} />
              <CheckboxGroup modelValue={tempValue.value as any[]} onUpdate:modelValue={(value: any[]) => (tempValue.value = value)}>
                {props.options.map((option) => (
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
