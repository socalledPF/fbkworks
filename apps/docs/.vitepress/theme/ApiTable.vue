<script setup lang="ts">
import { computed } from 'vue'
import api from './generated/api.json'

type ApiRow = {
  name: string
  type: string
  default: string
  required: boolean
  description: string
}

const props = defineProps<{
  /** api.json 里的组件名，例如 `ProTable` */
  component: keyof typeof api
  /** 默认渲染 props；events / slots / exposed 按需指定 */
  section?: 'props' | 'events' | 'slots' | 'exposed'
}>()

const SECTION_LABEL = {
  props: 'Props',
  events: 'Events',
  slots: 'Slots',
  exposed: 'Expose',
} as const

const rows = computed<ApiRow[]>(() => {
  const entry = api[props.component]
  if (!entry) return []
  return entry[props.section ?? 'props'] as ApiRow[]
})

const showDefault = computed(() => (props.section ?? 'props') === 'props')
const showRequired = computed(() => showDefault.value)
</script>

<template>
  <div class="fbk-api">
    <p class="fbk-api__caption">{{ SECTION_LABEL[section ?? 'props'] }}</p>

    <table>
      <thead>
        <tr>
          <th>名称</th>
          <th>类型</th>
          <th v-if="showDefault">默认值</th>
          <th v-if="showRequired">必填</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.name">
          <td><code>{{ row.name }}</code></td>
          <td><code class="fbk-api__type">{{ row.type }}</code></td>
          <td v-if="showDefault"><code>{{ row.default || '—' }}</code></td>
          <td v-if="showRequired">{{ row.required ? '是' : '否' }}</td>
          <td>{{ row.description || '—' }}</td>
        </tr>
        <tr v-if="rows.length === 0">
          <td :colspan="showDefault ? 5 : 3" class="fbk-api__empty">无</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
