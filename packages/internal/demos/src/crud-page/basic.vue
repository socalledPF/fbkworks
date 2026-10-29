<script setup lang="ts">
import { ref } from 'vue'
import { FbkCrudPage } from '@fbkworks/components/crud-page'
import type { ProTableColumn } from '@fbkworks/components/pro-table'
import type { QueryField } from '@fbkworks/components/query-form'
import { orderStatusEnum, queryOrders, type OrderRow } from '../data'

/**
 * CrudPage 的典型用法：查询区 + 表格 + 批量操作 + 一个由业务方自己控制的弹窗表单。
 * 对比 with-query.vue（手工连接同样的事），可以看出省掉了哪些样板代码。
 */
const fields: QueryField[] = [
  { name: 'keyword', label: '关键词', type: 'input', placeholder: '订单号 / 客户' },
  { name: 'status', label: '状态', type: 'select', options: [
    { label: '待支付', value: 0 },
    { label: '已完成', value: 1 },
    { label: '已取消', value: 2 },
  ] },
  { name: 'createdAt', label: '创建日期', type: 'date' },
]

const columns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', mobile: { primary: true } },
  { key: 'customer', title: '客户', dataIndex: 'customer' },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
  { key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum },
  { key: 'createdAt', title: '创建时间', dataIndex: 'createdAt', valueType: 'datetime', mobile: { hidden: true } },
]

const crudRef = ref<any>()
const selected = ref<Array<string | number>>([])
const showForm = ref(false)
</script>

<template>
  <FbkCrudPage
    ref="crudRef"
    :query-fields="fields"
    :columns="columns"
    :request="queryOrders"
    row-key="id"
    :selection="{ preserveOnReload: true }"
  >
    <template #toolbar>
      <button type="button" class="fbk-demo-btn fbk-demo-btn--primary" @click="showForm = true">新建</button>
    </template>

    <template #bulk-actions="{ selectedKeys }">
      <button
        type="button"
        class="fbk-demo-btn"
        :disabled="!selectedKeys.length"
        @click="selected = [...selectedKeys]"
      >
        批量处理 ({{ selectedKeys.length }})
      </button>
    </template>

    <template #form>
      <div v-if="showForm" data-demo-form>
        业务方自己的弹窗表单放在这里（CrudPage 不内置）。
        <button type="button" class="fbk-demo-btn" @click="showForm = false">关闭</button>
      </div>
    </template>
  </FbkCrudPage>
</template>
