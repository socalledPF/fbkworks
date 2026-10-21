<script setup lang="ts">
import { ref } from 'vue'
import { FbkFormGenerator } from '@fbk/components/form-generator'
import type { FormSchema } from '@fbk/components/form-generator'

/**
 * 覆盖全部已实现字段类型。
 *
 * date / datetime / date-range / radio 此前是静默降级成文本框的，
 * 这个 demo 用来确认它们现在真的路由到 DatePicker / Radio 原语，
 * 且三个适配器表现一致。
 */
const schema: FormSchema = {
  columns: 2,
  labelPosition: 'right',
  fields: [
    { name: 'name', label: '姓名', type: 'input', required: true },
    { name: 'age', label: '年龄', type: 'number' },
    {
      name: 'gender',
      label: '性别',
      type: 'radio',
      options: [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
      ],
      defaultValue: 'male',
    },
    {
      name: 'level',
      label: '等级',
      type: 'select',
      options: [
        { label: '普通', value: 1 },
        { label: 'VIP', value: 2 },
      ],
    },
    { name: 'birthday', label: '出生日期', type: 'date' },
    { name: 'joinedAt', label: '入职时间', type: 'datetime' },
    { name: 'range', label: '有效期', type: 'date-range' },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
}

const values = ref<Record<string, any>>({})
const submitted = ref<Record<string, any> | null>(null)
</script>

<template>
  <div>
    <FbkFormGenerator v-model="values" :schema="schema" @submit="submitted = $event" />
    <pre v-if="submitted">{{ submitted }}</pre>
  </div>
</template>
