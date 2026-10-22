<script setup lang="ts">
import { ref } from 'vue'
import { FbkCrudPage } from '@fbk/components/crud-page'
import { FbkPageContainer } from '@fbk/components/page-container'
import type { ProTableColumn } from '@fbk/components/pro-table'
import type { QueryField } from '@fbk/components/query-form'
import { fetchUsers, toggleUser, type UserRow } from '../mock/data'

/**
 * 用户管理。
 *
 * 与订单页的差别：这里检验**表格内的即时操作**（开关切换），
 * 不弹窗、不跳转 —— 状态变更后只更新单行，不整表刷新。
 */
const crudRef = ref<any>(null)

const queryFields: QueryField[] = [
  { name: 'keyword', label: '关键词', type: 'input', placeholder: '用户名 / 姓名 / 邮箱' },
  {
    name: 'role',
    label: '角色',
    type: 'select',
    options: ['管理员', '运营', '客服', '财务'].map((v) => ({ label: v, value: v })),
  },
  {
    name: 'enabled',
    label: '状态',
    type: 'select',
    // SelectOption.value 是 string | number，用字符串再在 mock 里比较
    options: [
      { label: '启用', value: 'true' },
      { label: '禁用', value: 'false' },
    ],
  },
]

const columns: ProTableColumn<UserRow>[] = [
  { key: 'username', title: '用户名', dataIndex: 'username', width: 130 },
  { key: 'realName', title: '姓名', dataIndex: 'realName', width: 100 },
  { key: 'role', title: '角色', dataIndex: 'role', width: 100 },
  { key: 'dept', title: '部门', dataIndex: 'dept', width: 110 },
  { key: 'email', title: '邮箱', dataIndex: 'email', width: 200 },
  {
    key: 'lastLogin',
    title: '最近登录',
    dataIndex: 'lastLogin',
    valueType: 'datetime',
    width: 170,
    sortable: true,
  },
  {
    key: 'enabled',
    title: '状态',
    dataIndex: 'enabled',
    width: 100,
    // valueEnum 的 key 只能是 string | number，布尔值要写成字符串
    valueEnum: {
      true: { text: '启用', status: 'success' },
      false: { text: '禁用', status: 'default' },
    },
    render: ({ value }: { value: unknown }) => (value ? '启用' : '禁用'),
  },
  {
    key: 'actions',
    title: '操作',
    valueType: 'actions',
    width: 100,
    fixed: 'right',
    actions: [
      {
        key: 'toggle',
        text: '切换状态',
        variant: 'link',
        onClick: async ({ row }) => {
          await toggleUser(row.id, !row.enabled)
          crudRef.value?.reload()
        },
      },
    ],
  },
]
</script>

<template>
  <FbkPageContainer
    title="用户管理"
    subtitle="管理后台账号与权限角色"
    :breadcrumbs="[{ text: '交易管理' }, { text: '用户管理' }]"
  >
    <FbkCrudPage
      ref="crudRef"
      :query-fields="queryFields"
      :columns="columns"
      :request="fetchUsers"
      row-key="id"
    >
      <template #toolbar>
        <button type="button" class="admin-btn admin-btn--primary">邀请用户</button>
        <button type="button" class="admin-btn">导出</button>
      </template>
    </FbkCrudPage>
  </FbkPageContainer>
</template>
