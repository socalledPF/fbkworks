<script setup lang="ts">
import { ref } from 'vue'
import { FbkFormModal } from '@fbkworks/components/form-modal'
import { FbkProTable } from '@fbkworks/components/pro-table'
import type { ProTableColumn } from '@fbkworks/components/pro-table'
import type { FormSchema } from '@fbkworks/components/form-generator'
import { useAdapter } from '@fbkworks/adapter-core'
import { orderStatusEnum, queryOrders, type OrderRow } from '../data'

/**
 * 弹窗表单的典型用法：列表里点「编辑」回填，点「新建」用默认值，
 * 提交成功后自动关闭并刷新列表。
 *
 * FormModal 不内置请求与提示 —— submit 由这里注入，
 * 成功提示用 adapter.feedback 自己调，保持零依赖。
 */
const adapter = useAdapter()
const show = ref(false)
const mode = ref<'create' | 'edit'>('create')
const current = ref<Partial<OrderRow>>({})
const tableRef = ref<any>()

const schema: FormSchema = {
  columns: 1,
  fields: [
    { name: 'orderNo', label: '订单号', type: 'input', required: true },
    { name: 'customer', label: '客户', type: 'input', required: true },
    { name: 'amount', label: '金额', type: 'number' },
    { name: 'createdAt', label: '创建时间', type: 'date' },
    {
      name: 'status',
      label: '状态',
      type: 'radio',
      options: [
        { label: '待支付', value: 0 },
        { label: '已完成', value: 1 },
        { label: '已取消', value: 2 },
      ],
    },
  ],
}

const columns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo' },
  { key: 'customer', title: '客户', dataIndex: 'customer' },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
  { key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum },
  {
    key: 'op',
    title: '操作',
    valueType: 'actions',
    width: 100,
    actions: [{ key: 'edit', text: '编辑', onClick: ({ row }) => openEdit(row) }],
  },
]

function openCreate() {
  mode.value = 'create'
  current.value = {}
  show.value = true
}

function openEdit(row: OrderRow) {
  mode.value = 'edit'
  current.value = { ...row }
  show.value = true
}

async function submit(values: Record<string, any>) {
  // 模拟请求。抛错时 FormModal 会保持打开并保留用户输入
  await new Promise((resolve) => setTimeout(resolve, 400))
  adapter.feedback.message.success(
    `已${mode.value === 'edit' ? '保存' : '创建'}：${values.orderNo}`,
  )
  tableRef.value?.reload()
}
</script>

<template>
  <div class="fbk-demo-stack">
    <div>
      <button type="button" class="fbk-demo-btn fbk-demo-btn--primary" data-act="create" @click="openCreate">
        新建订单
      </button>
    </div>

    <FbkProTable ref="tableRef" :columns="columns" :request="queryOrders" row-key="id" />

    <FbkFormModal
      v-model:show="show"
      :mode="mode"
      :schema="schema"
      :initial-values="current"
      :submit="submit"
      :title="mode === 'edit' ? '编辑订单' : '新建订单'"
    />
  </div>
</template>
