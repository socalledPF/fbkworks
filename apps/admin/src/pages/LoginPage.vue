<script setup lang="ts">
import { ref } from 'vue'

/**
 * 登录页。
 *
 * 用组件库的 FormGenerator 而不是手写表单 —— 这是对 FormGenerator
 * 的一次真实检验：登录表单有校验、有禁用态、有 loading。
 */
import { FbkFormGenerator } from '@fbk/components/form-generator'
import type { FormField, FormSchema } from '@fbk/components/form-generator'

const emit = defineEmits<{ success: [user: { name: string; role: string }] }>()

const model = ref<Record<string, any>>({ username: 'admin', password: 'admin123', remember: true })
const loading = ref(false)
const error = ref('')

const loginFields: FormField[] = [
  {
    name: 'username',
    label: '账号',
    type: 'input',
    required: true,
    placeholder: '请输入账号',
    help: 'demo 环境任意账号可登录',
  },
  {
    name: 'password',
    label: '密码',
    // FormFieldType 里没有 password，用 input + uiProps 透传 type
    type: 'input',
    required: true,
    placeholder: '请输入密码',
    uiProps: { type: 'password' },
  },
  {
    name: 'remember',
    label: '记住我',
    type: 'switch',
  },
]

// FormGenerator 接受的是 schema 对象（含 fields / labelWidth / columns），不是裸数组
// showActions=false：登录页有自己的「登录」按钮，避免出现两组按钮
const schema: FormSchema = { fields: loginFields, labelWidth: 70 }
const formProps = { showActions: false }

async function submit() {
  error.value = ''
  if (!model.value.username || !model.value.password) {
    error.value = '账号和密码不能为空'
    return
  }
  loading.value = true
  // 模拟登录请求
  await new Promise((r) => setTimeout(r, 600))
  loading.value = false

  if (model.value.password.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  emit('success', { name: model.value.username, role: '管理员' })
}
</script>

<template>
  <div class="login">
    <div class="login__card">
      <div class="login__brand">
        <span class="login__logo">F</span>
        <div>
          <h1 class="login__title">FBK Admin</h1>
          <p class="login__subtitle">基于 @fbk 组件库的后台管理系统</p>
        </div>
      </div>

      <FbkFormGenerator v-model="model" :schema="schema" :disabled="loading" v-bind="formProps" @submit="submit" />

      <p v-if="error" class="login__error" role="alert">{{ error }}</p>

      <button type="button" class="login__submit" :disabled="loading" @click="submit">
        {{ loading ? '登录中…' : '登 录' }}
      </button>

      <p class="login__hint">演示账号：admin / admin123</p>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  background: var(--fbk-color-bg);
}

.login__card {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-lg);
  width: 380px;
  padding: var(--fbk-spacing-xxl);
  background: var(--fbk-color-bg-container);
  border: 1px solid var(--fbk-color-border-light);
  border-radius: var(--fbk-radius-lg);
  box-shadow: var(--fbk-shadow-md);
}

.login__brand {
  display: flex;
  gap: var(--fbk-spacing-md);
  align-items: center;
}

.login__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: var(--fbk-font-size-xl);
  font-weight: var(--fbk-font-weight-semibold);
  color: var(--fbk-color-on-primary);
  background: var(--fbk-color-primary);
  border-radius: var(--fbk-radius-md);
}

.login__title {
  margin: 0;
  font-size: var(--fbk-font-size-xl);
  font-weight: var(--fbk-font-weight-semibold);
  color: var(--fbk-color-text);
}

.login__subtitle {
  margin: var(--fbk-spacing-xs) 0 0;
  font-size: var(--fbk-font-size-sm);
  color: var(--fbk-color-text-secondary);
}

.login__submit {
  padding: var(--fbk-spacing-sm) var(--fbk-spacing-md);
  font-family: var(--fbk-font-family);
  font-size: var(--fbk-font-size-md);
  color: var(--fbk-color-on-primary);
  cursor: pointer;
  background: var(--fbk-color-primary);
  border: 0;
  border-radius: var(--fbk-radius-md);
  transition: background-color 0.15s ease;
}

.login__submit:hover:not(:disabled) {
  background: var(--fbk-color-primary-fill-hover);
}

.login__submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.login__submit:focus-visible {
  outline: none;
  box-shadow: var(--fbk-shadow-focus-ring);
}

.login__error {
  margin: 0;
  font-size: var(--fbk-font-size-sm);
  color: var(--fbk-color-danger-text);
}

.login__hint {
  margin: 0;
  font-size: var(--fbk-font-size-sm);
  color: var(--fbk-color-text-tertiary);
  text-align: center;
}
</style>
