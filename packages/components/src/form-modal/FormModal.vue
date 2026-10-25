<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, ref, useAttrs, watch } from 'vue'
import { toErrorEvent, useReporter } from '@fbk/adapter-core'
import { useAdapter } from '@fbk/adapter-core'
import { FbkFormGenerator } from '../form-generator'
import type { FormGeneratorExpose } from '../form-generator'
import type { FormModalExpose, FormModalMode, FormModalProps } from './types'

/**
 * 弹窗表单。
 *
 * 关键编排逻辑（都是手写时最容易漏的）：
 *   · 打开时按 mode 决定回填 initialValues 还是 defaultValues
 *   · 关闭时清空校验状态 —— 否则下次打开会带着上次的红框
 *   · 提交失败保持打开并保留输入 —— 直接关掉会让用户重填
 *   · 提交中禁止关闭 —— 半途关掉会导致状态与后端不一致
 */
defineOptions({ name: 'FbkFormModal', inheritAttrs: false })

const props = withDefaults(defineProps<FormModalProps<T>>(), {
  show: false,
  title: undefined,
  mode: 'create',
  initialValues: undefined,
  defaultValues: undefined,
  width: undefined,
  placement: 'center',
  closeOnClickModal: true,
  closeOnSuccess: true,
  autoFocus: true,
  submitText: undefined,
  cancelText: '取消',
  maskClosableWhileSubmitting: true,
})

const attrs = useAttrs()

const reporter = useReporter()

const emit = defineEmits<{
  'update:show': [show: boolean]
  /** 提交成功，参数是提交的值。业务方通常在这里刷新列表 */
  success: [values: Record<string, any>, mode: FormModalMode]
  /** 提交失败，参数是抛出的错误 */
  error: [error: unknown]
  /** 弹窗关闭（无论成功与否） */
  close: []
  /** 打开 */
  open: []
}>()

const adapter = useAdapter()
const { Dialog, Button } = adapter.primitives

const formRef = ref<FormGeneratorExpose>()
const submitting = ref(false)
const innerMode = ref<FormModalMode>(props.mode)
const values = ref<Record<string, any>>({})
/** 每次打开递增，用作 FormGenerator 的 key，强制重建以清空内部状态 */
const formKey = ref(0)

watch(
  () => props.mode,
  (mode) => (innerMode.value = mode),
)

function syncOnOpen() {
  // 打开时按当前 mode 决定回填哪一份
  const source = innerMode.value === 'edit' ? (props.initialValues ?? {}) : (props.defaultValues ?? {})
  values.value = { ...source }
  /* 递增 key 强制 FormGenerator 重建，清掉上一轮的内部状态。
     注意顺序：必须在 values 赋值之后。FormGenerator 内部的 useQueryModel
     在 setup 时读一次 modelValue 建初始状态，如果 key 先变、values 后变，
     子组件会用旧的空对象初始化 —— 表现为「弹窗打开了但输入框全空」。 */
  formKey.value += 1
}

function clearOnClose() {
  // 关闭时清掉校验状态，避免下次打开带着上次的红框
  formRef.value?.resetFields?.()
  values.value = {}
}

watch(
  () => props.show,
  (visible, wasVisible) => {
    if (visible) {
      syncOnOpen()
      emit('open')
    } else if (wasVisible !== undefined) {
      clearOnClose()
    }
  },
  /* immediate：组件挂载时 show 已经是 true（例如 v-if 控制外层）的情况下，
     不立即执行就永远不会回填。
     flush: 'post'：业务侧的典型写法是
       `current.value = row; show.value = true`
     两个赋值在同一个 tick。默认的 'pre' 会在**组件更新前**跑回调，
     此时 props.initialValues 还是上一轮的值 —— 表现为「弹窗打开了但输入框全空」。
     改成 'post' 保证读到的是本次更新后的 props。 */
  { immediate: true, flush: 'post' },
)

const title = computed(() => {
  if (props.title) return props.title
  return innerMode.value === 'edit' ? '编辑' : '新建'
})

const confirmText = computed(
  () => props.submitText ?? (innerMode.value === 'edit' ? '保存' : '确定'),
)

const closable = computed(
  () => !(submitting.value && props.maskClosableWhileSubmitting),
)

function setShow(next: boolean) {
  if (!next && !closable.value) return
  emit('update:show', next)
}

function close() {
  if (!closable.value) return
  emit('update:show', false)
}

function onDialogUpdate(next: boolean) {
  setShow(next)
}

async function submit() {
  if (submitting.value) return

  /* 先校验，不通过直接返回。
     契约里 validate() 的返回类型是 Promise<true>，但真实适配器在校验失败时
     会 **reject**（element-plus 的 ElForm.validate 就是这样），所以必须用
     try/catch 兜住 —— 只看返回值会漏掉最常见的失败路径。
     行内红框与提示文案由 FormItem 自己呈现，这里不重复提示。 */
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  const payload = { ...values.value }
  submitting.value = true
  try {
    const result = await props.submit(payload, innerMode.value)
    // 返回 false 视为失败，保持打开
    if (result === false) return

    emit('success', payload, innerMode.value)
    if (props.closeOnSuccess) emit('update:show', false)
  } catch (error) {
    // 失败时保持打开并保留用户输入
    emit('error', error)
    // 统一上报：表单提交失败是高频问题，但业务方常常忘记接 error 事件
    reporter.error(
      toErrorEvent(error, 'component', 'FbkFormModal', {
        mode: innerMode.value,
        fields: Object.keys(payload),
      }),
    )
  } finally {
    submitting.value = false
  }
}

function open(next?: Partial<T>) {
  if (next) {
    innerMode.value = 'edit'
    values.value = { ...next }
  }
  emit('update:show', true)
}

function openEdit(next: Partial<T>) {
  innerMode.value = 'edit'
  values.value = { ...next }
  emit('update:show', true)
}

defineExpose<FormModalExpose<T>>({
  open,
  openEdit,
  close,
  submit,
  getValues: () => ({ ...values.value }),
  get formRef() {
    return formRef.value
  },
  get submitting() {
    return submitting.value
  },
})

/** FormGenerator 用 v-model，这里做双向同步 */
function onModelUpdate(next: Record<string, any>) {
  values.value = next
}
</script>

<template>
  <component
    :is="Dialog"
    v-bind="attrs"
    :model-value="show"
    :title="title"
    :width="width"
    :placement="placement"
    :close-on-click-modal="closeOnClickModal && closable"
    :show-close="closable"
    @update:model-value="onDialogUpdate"
    @close="emit('close')"
  >
    <FbkFormGenerator
      :key="formKey"
      ref="formRef"
      :model-value="values as Partial<T>"
      :schema="schema"
      :show-actions="false"
      @update:model-value="onModelUpdate"
      @submit="submit"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps" :key="name">
        <slot :name="name" v-bind="slotProps" />
      </template>
    </FbkFormGenerator>

    <template #footer>
      <div class="fbk-form-modal__footer">
        <slot name="footer" :submitting="submitting" :submit="submit" :close="close">
          <component :is="Button" :disabled="submitting" @click="close">{{ cancelText }}</component>
          <component :is="Button" variant="primary" :loading="submitting" @click="submit">
            {{ confirmText }}
          </component>
        </slot>
      </div>
    </template>
  </component>
</template>
