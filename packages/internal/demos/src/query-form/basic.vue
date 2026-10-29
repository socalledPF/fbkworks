<script setup lang="ts">
import { ref } from 'vue'
import { FbkQueryForm } from '@fbkworks/components/query-form'
import type { QueryField } from '@fbkworks/components/query-form'

const fields: QueryField[] = [
  { name: 'keyword', label: '关键词', type: 'input', placeholder: '订单号 / 客户' },
  {
    name: 'status',
    label: '状态',
    type: 'select',
    options: [
      { label: '待支付', value: 0 },
      { label: '已完成', value: 1 },
      { label: '已取消', value: 2 },
    ],
  },
  { name: 'owner', label: '负责人', type: 'input' },
  { name: 'remark', label: '备注', type: 'input' },
]

const values = ref<Record<string, any>>({})
const submitted = ref<Record<string, any> | null>(null)
</script>

<template>
  <div>
    <FbkQueryForm
      v-model="values"
      :fields="fields"
      :columns="3"
      :visible-count="3"
      @submit="submitted = $event"
    />
    <pre v-if="submitted">{{ submitted }}</pre>
  </div>
</template>
