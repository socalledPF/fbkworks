<script setup lang="ts">
import { ref } from 'vue'
import { hasPermission, usePermission } from '@fbkworks/adapter-core'
import { FbkCrudPage } from '@fbkworks/components/crud-page'
import { FbkPageContainer } from '@fbkworks/components/page-container'
import { FbkFormModal } from '@fbkworks/components/form-modal'
import type { ProTableColumn } from '@fbkworks/components/pro-table'
import type { Status } from '@fbkworks/adapter-core'
import type { QueryField } from '@fbkworks/components/query-form'
import type { FormSchema } from '@fbkworks/components/form-generator'
import {
  deleteOrders,
  fetchOrders,
  ORDER_STATUS_MAP,
  saveOrder,
  type OrderRow,
} from '../mock/data'
import { navigate } from '../router'

/**
 * 订单列表：CRUD 页面的完整形态。
 *
 * 检验点：
 *   · 查询区 + 表格联动（QueryForm + ProTable 通过 CrudPage 自动连接）
 *   · 多选 + 批量操作
 *   · 弹窗表单新增/编辑（FormModal）
 *   · 跳转详情
 */
const crudRef = ref<any>(null)
const { list: permissions } = usePermission()

/* 表格当前页码。页面本来不需要它 —— 它只为「删空某页后回退」而存在。
   见 refreshAfterDelete 的注释：CrudPage 没有暴露页码控制，
   所以页码以受控 prop 的形式经 tableProps 喂回 ProTable。 */
const currentPage = ref(1)

function onPageChange(page: number) {
  currentPage.value = page
}

const queryFields: QueryField[] = [
  { name: 'keyword', label: '关键词', type: 'input', placeholder: '订单号 / 客户 / 手机' },
  {
    name: 'status',
    label: '订单状态',
    type: 'select',
    options: Object.entries(ORDER_STATUS_MAP).map(([value, v]) => ({ label: v.text, value })),
  },
  {
    name: 'channel',
    label: '渠道',
    type: 'select',
    options: ['直营', '分销', '电商', '门店'].map((v) => ({ label: v, value: v })),
  },
  { name: 'dateRange', label: '下单日期', type: 'date-range' },
]

const columns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo', width: 160, fixed: 'left' },
  { key: 'customer', title: '客户', dataIndex: 'customer', width: 100 },
  { key: 'phone', title: '手机号', dataIndex: 'phone', width: 130 },
  {
    key: 'channel',
    title: '渠道',
    dataIndex: 'channel',
    width: 90,
  },
  {
    key: 'amount',
    title: '金额',
    dataIndex: 'amount',
    valueType: 'money',
    width: 120,
    align: 'right',
    sortable: true,
  },
  {
    key: 'status',
    title: '状态',
    dataIndex: 'status',
    valueType: 'enum',
    width: 100,
    valueEnum: Object.fromEntries(
      Object.entries(ORDER_STATUS_MAP).map(([k, v]) => [k, { text: v.text, status: v.status as Status }]),
    ),
  },
  { key: 'itemCount', title: '件数', dataIndex: 'itemCount', width: 80, align: 'right' },
  {
    key: 'createdAt',
    title: '下单时间',
    dataIndex: 'createdAt',
    valueType: 'datetime',
    width: 170,
    sortable: true,
  },
  {
    key: 'actions',
    title: '操作',
    valueType: 'actions',
    width: 140,
    fixed: 'right',
    actions: [
      {
        key: 'detail',
        text: '详情',
        variant: 'link',
        onClick: ({ row }) => navigate(`/orders/${row.id}`),
      },
      {
        key: 'edit',
        text: '编辑',
        variant: 'link',
        onClick: ({ row }) => openEdit(row),
      },
      {
        key: 'delete',
        text: '删除',
        variant: 'link',
        status: 'danger',
        confirm: '确定删除这条订单？',
        // 无权限时整列按钮不渲染（ProTable 的 visible 支持函数）
        visible: () => hasPermission(permissions(), 'order:delete'),
        onClick: async ({ row }) => {
          const shown = crudRef.value?.getData()?.length ?? 0
          await deleteOrders([row.id])
          refreshAfterDelete(shown - 1)
        },
      },
    ],
  },
]

// ---------- 弹窗表单 ----------

const modalVisible = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
/** edit 模式的回填值 */
const editing = ref<Partial<OrderRow>>({})
/* create 模式的默认值。FormModal 只在 defaultValues 上读它 ——
   写进 initialValues 时 create 模式拿到的是 {}，弹窗永远空白打开。 */
const createDefaults: Partial<OrderRow> = { status: 'pending', channel: '直营', itemCount: 1 }

const formSchema: FormSchema<OrderRow> = {
  fields: [
    { name: 'orderNo', label: '订单号', type: 'input', required: true, placeholder: '如 SO2026000001' },
    { name: 'customer', label: '客户', type: 'input', required: true },
    { name: 'phone', label: '手机号', type: 'input', required: true, placeholder: '11 位手机号' },
    {
      name: 'channel',
      label: '渠道',
      type: 'select',
      required: true,
      options: ['直营', '分销', '电商', '门店'].map((v) => ({ label: v, value: v })),
    },
    { name: 'amount', label: '金额', type: 'number', required: true },
    {
      name: 'status',
      label: '状态',
      type: 'select',
      required: true,
      options: Object.entries(ORDER_STATUS_MAP).map(([value, v]) => ({ label: v.text, value })),
    },
    { name: 'address', label: '收货地址', type: 'textarea' },
    { name: 'remark', label: '备注', type: 'textarea' },
  ],
  labelWidth: 90,
}

function openCreate() {
  modalMode.value = 'create'
  modalVisible.value = true
}

function openEdit(row: OrderRow) {
  modalMode.value = 'edit'
  editing.value = { ...row }
  modalVisible.value = true
}

async function onSubmit(values: Record<string, any>) {
  await saveOrder(values as Partial<OrderRow>)
  // 返回后 FormModal 会自己关闭（closeOnSuccess 默认 true）
}

// ---------- 删除后的刷新 ----------

/**
 * 删除成功后刷新，并把「删空一页」的页码收回来。
 *
 * 只调 refresh() 会停在原页：CrudPage 的 refresh 就是 ProTable.reload()，
 * 不带 resetPage，删掉某页最后一条后用户看到的是一张空白页。
 * CrudPage 没有暴露页码控制，所以页码走受控 prop：把 page 放进 tableProps，
 * ProTable 的 watch(() => props.page) 会把内部页码同步过去并重发那一页。
 *
 * @param remainingOnPage 本页删除之后还剩几行
 */
function refreshAfterDelete(remainingOnPage: number) {
  if (remainingOnPage <= 0 && currentPage.value > 1) {
    currentPage.value -= 1
    return
  }
  crudRef.value?.refresh()
}

// ---------- 批量操作 ----------

async function batchDelete(keys: number[], clear: () => void) {
  if (!keys.length) return
  /* 选中项可以跨页保留（selection.preserveOnReload），
     所以只能数「落在本页上的那几个」，直接用 keys.length 会多算。 */
  const keysOnPage = new Set((crudRef.value?.getData() ?? []).map((row: OrderRow) => row.id))
  const shown = keysOnPage.size
  const deletedHere = keys.filter((key) => keysOnPage.has(key)).length
  await deleteOrders(keys)
  clear()
  refreshAfterDelete(shown - deletedHere)
}
</script>

<template>
  <!-- CrudPage 只负责「查询区 + 表格」，标题与面包屑由 PageContainer 提供。
       早期直接把 title 传给 CrudPage —— 它没有这个 prop，被静默丢弃。 -->
  <FbkPageContainer
    title="订单列表"
    subtitle="共 128 条订单数据，支持多条件筛选与服务端排序"
    :breadcrumbs="[{ text: '交易管理' }, { text: '订单列表' }]"
  >
    <FbkCrudPage
      ref="crudRef"
      :query-fields="queryFields"
      :columns="columns"
      :request="fetchOrders"
      row-key="id"
      :selection="{ preserveOnReload: true }"
      :table-props="{ page: currentPage }"
      @update:page="onPageChange"
    >
      <!-- 工具栏：插槽名是 toolbar（不是 actions），参数带当前查询条件 -->
      <template #toolbar>
        <button type="button" class="admin-btn admin-btn--primary" @click="openCreate">
          新建订单
        </button>
      </template>

      <!-- 批量操作区：插槽直接给出 selectedKeys 与 clear() -->
      <template #bulk-actions="{ selectedKeys: keys, clear }">
        <span class="admin-bulk__label">
          {{ keys.length ? `已选 ${keys.length} 条` : '批量操作' }}
        </span>
        <!-- v-permission：无权限时元素从 DOM 移除（不是 display:none）。
             控制台一行 el.click() 也触发不了它，因为元素根本不存在。 -->
        <button
          v-permission="'order:delete'"
          type="button"
          class="admin-btn admin-btn--danger"
          :disabled="!keys.length"
          @click="batchDelete(keys as number[], clear)"
        >
          批量删除
        </button>
        <button type="button" class="admin-btn" :disabled="!keys.length" @click="clear">
          取消选择
        </button>
      </template>
    </FbkCrudPage>
  </FbkPageContainer>

  <FbkFormModal
    v-model:show="modalVisible"
    :mode="modalMode"
    :title="modalMode === 'create' ? '新建订单' : '编辑订单'"
    :schema="formSchema"
    :initial-values="editing"
    :default-values="createDefaults"
    :submit="onSubmit"
    @success="crudRef?.refresh()"
  />
</template>

<style scoped>
.admin-bulk__label {
  margin-right: auto;
  font-size: var(--fbk-font-size-sm);
  color: var(--fbk-color-text-secondary);
}
</style>
