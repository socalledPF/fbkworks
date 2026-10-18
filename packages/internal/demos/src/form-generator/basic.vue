<script setup lang="ts">
import { ref } from 'vue'
import { FbkFormGenerator } from '@fbk/components/form-generator'
import type { FormSchema } from '@fbk/components/form-generator'

const schema: FormSchema = {
  columns: 2,
  labelPosition: 'right',
  fields: [
    { name: 'name', label: '姓名', type: 'input', required: true },
    { name: 'age', label: '年龄', type: 'number' },
    {
      name: 'gender',
      label: '性别',
      type: 'select',
      options: [
        { label: '男', value: 'male' },
        { label: '女', value: 'female' },
      ],
    },
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
