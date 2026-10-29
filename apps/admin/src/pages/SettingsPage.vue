<script setup lang="ts">
import { ref } from 'vue'
import { FbkPageContainer } from '@fbkworks/components/page-container'
import { FbkFormGenerator } from '@fbkworks/components/form-generator'
import type { FormField, FormSchema } from '@fbkworks/components/form-generator'

/**
 * 系统设置。
 *
 * 检验 FormGenerator 在「非弹窗、独立页面」场景下的表现：
 * 长表单、分组、多种控件类型、保存反馈。
 */
const saving = ref(false)
const saved = ref(false)

const model = ref<Record<string, any>>({
  siteName: 'FBK Admin',
  siteDesc: '基于 @fbkworks 组件库构建的后台管理系统',
  contactEmail: 'admin@example.com',
  region: 'cn',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD',
  pageSize: 20,
  enableNotify: true,
  enableAudit: false,
  notifyChannel: 'email',
  theme: 'light',
})

const settingsFields: FormField[] = [
  { name: 'siteName', label: '站点名称', type: 'input', required: true, span: 2 },
  { name: 'siteDesc', label: '站点描述', type: 'textarea', span: 2 },
  { name: 'contactEmail', label: '联系邮箱', type: 'input', required: true },
  { name: 'dateFormat', label: '日期格式', type: 'select', options: [
    { label: '2026-10-22', value: 'YYYY-MM-DD' },
    { label: '2026/10/22', value: 'YYYY/MM/DD' },
  ] },
  { name: 'pageSize', label: '默认每页条数', type: 'number' },
  { name: 'theme', label: '默认主题', type: 'radio', options: [
    { label: '亮色', value: 'light' },
    { label: '暗色', value: 'dark' },
  ] },
  {
    name: 'region',
    label: '部署区域',
    type: 'select',
    options: [
      { label: '中国大陆', value: 'cn' },
      { label: '海外', value: 'overseas' },
    ],
  },
  {
    /* options 是函数 → 选项随「部署区域」变化。
       这是 FormGenerator 的联动能力：不需要业务方把 options
       放进 ref 再手动 watch。 */
    name: 'timezone',
    label: '时区',
    type: 'select',
    options: (values: Record<string, any>) =>
      values.region === 'overseas'
        ? [
            { label: 'UTC', value: 'UTC' },
            { label: '美国东部时间', value: 'America/New_York' },
            { label: '欧洲中部时间', value: 'Europe/Berlin' },
          ]
        : [
            { label: '中国标准时间 (UTC+8)', value: 'Asia/Shanghai' },
            { label: 'UTC', value: 'UTC' },
          ],
  },
  { name: 'enableNotify', label: '开启消息通知', type: 'switch' },
  { name: 'enableAudit', label: '开启操作审计', type: 'switch' },
  {
    /* options 函数形式：联动演示。
       只有开启通知时才有意义 —— 之前只能用 disabled 让整行变灰，
       现在选项本身也能按条件变化。 */
    name: 'notifyChannel',
    label: '通知渠道',
    type: 'radio',
    options: [
      { label: '邮件', value: 'email' },
      { label: '短信', value: 'sms' },
      { label: '站内信', value: 'inbox' },
    ],
    // 只有开启通知时这个字段才有意义 —— 检验依赖禁用
    disabled: (m: Record<string, any>) => !m.enableNotify,
  },
]

const schema: FormSchema = { fields: settingsFields, labelWidth: 130, columns: 2 }

async function save() {
  saving.value = true
  saved.value = false
  await new Promise((r) => setTimeout(r, 500))
  saving.value = false
  saved.value = true
  setTimeout(() => (saved.value = false), 2500)
}
</script>

<template>
  <FbkPageContainer title="系统设置" subtitle="这些配置对所有用户生效">
    <div class="settings">
      <section class="settings__card">
        <h2 class="settings__title">基础配置</h2>
        <FbkFormGenerator v-model="model" :schema="schema" :disabled="saving" />
      </section>

      <div class="settings__actions">
        <button
          type="button"
          class="admin-btn admin-btn--primary"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? '保存中…' : '保存设置' }}
        </button>
        <button type="button" class="admin-btn" :disabled="saving">重置</button>
        <span v-if="saved" class="settings__saved" role="status">✓ 已保存</span>
      </div>
    </div>
  </FbkPageContainer>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--fbk-spacing-lg);
}

.settings__card {
  padding: var(--fbk-spacing-lg);
  background: var(--fbk-color-bg-container);
  border: 1px solid var(--fbk-color-border-light);
  border-radius: var(--fbk-radius-lg);
}

.settings__title {
  margin: 0 0 var(--fbk-spacing-lg);
  font-size: var(--fbk-font-size-lg);
  font-weight: var(--fbk-font-weight-semibold);
  color: var(--fbk-color-text);
}

.settings__actions {
  display: flex;
  gap: var(--fbk-spacing-md);
  align-items: center;
}

.settings__saved {
  font-size: var(--fbk-font-size-sm);
  color: var(--fbk-color-success-text);
}
</style>
