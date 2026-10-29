<script setup lang="ts">
import { ref } from 'vue'
import { FbkProTable } from '@fbk/components/pro-table'
import type { ProTableColumn, TableRequest } from '@fbk/components/pro-table'
import { FbkDetailDrawer } from '@fbk/components/detail-drawer'
import type { DescriptionItem } from '@fbk/components/descriptions'
import { useAdapter } from '@fbk/adapter-core'
import { orderStatusEnum, queryOrders, type OrderRow } from '../data'

/**
 * 详情抽屉：点表格的一行 → 右侧滑出详情。
 *
 * 要看的点：
 *   · 字段渲染与 DetailPage 是同一套（同一个 items + field-* 插槽），
 *     这里用 `#field-amount` 只改「金额」一项，其它照旧
 *   · 「已取消」的订单在详情接口里返回 null（模拟记录已被删除）→ 404 态
 *   · 桌面右侧 480px；把窗口缩到 639px 以下再点一次 → 底部全屏
 *   · @expand 只发事件，跳不跳整页由业务方决定（组件不假设 SPA）
 *   · 关闭后列表的页码与筛选都还在 —— 这就是抽屉相对跳页的优势
 */
const adapter = useAdapter()

const show = ref(false)
const current = ref<OrderRow | null>(null)

/** 详情比列表多几个字段：同一个数据源，字段描述换个 items 就行 */
interface OrderDetail extends OrderRow {
  address: string
  remark: string
}

const detailItems: DescriptionItem<OrderDetail>[] = [
  { key: 'orderNo', label: '订单号', dataIndex: 'orderNo' },
  { key: 'customer', label: '客户', dataIndex: 'customer' },
  { key: 'amount', label: '金额', dataIndex: 'amount' },
  { key: 'status', label: '状态', getValue: (row) => orderStatusEnum[row.status].text },
  { key: 'createdAt', label: '下单时间', dataIndex: 'createdAt' },
  { key: 'address', label: '收货地址', dataIndex: 'address', span: 2 },
  { key: 'remark', label: '备注', dataIndex: 'remark', span: 2 },
]

const columns: ProTableColumn<OrderRow>[] = [
  { key: 'orderNo', title: '订单号', dataIndex: 'orderNo' },
  { key: 'customer', title: '客户', dataIndex: 'customer' },
  { key: 'amount', title: '金额', dataIndex: 'amount', valueType: 'money', align: 'right' },
  { key: 'status', title: '状态', dataIndex: 'status', valueType: 'enum', valueEnum: orderStatusEnum },
  { key: 'createdAt', title: '下单时间', dataIndex: 'createdAt' },
]

const request: TableRequest<OrderRow> = queryOrders

function openDetail(row: OrderRow) {
  /* 业务侧的真实写法就是这个顺序：先定行，再打开。
     抽屉每次打开都会重新请求，拿到的是最新详情。 */
  current.value = row
  show.value = true
}

/** 模拟详情接口：返回 null 表示资源不存在（渲染 404，不是空白） */
async function fetchDetail(): Promise<OrderDetail | null> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  const row = current.value
  if (!row) return null
  // 演示 404：状态为「已取消」的记录在服务端已经不存在了
  if (row.status === 2) return null
  return {
    ...row,
    address: '上海市浦东新区世纪大道 100 号',
    remark: '客户要求工作日 18:00 后配送',
  }
}

function onExpand(row: OrderDetail | null) {
  // 组件不自己导航：这里才是业务方决定用 router 还是别的
  adapter.feedback.message.info(`业务方收到 expand：${row?.orderNo ?? '无数据'}，此处跳整页`)
}
</script>

<template>
  <div class="fbk-demo-stack">
    <p class="fbk-demo-note">
      点任意一行打开详情抽屉。「已取消」的订单详情接口返回 null，用来演示 404 态；
      把窗口缩到 639px 以下再点一次，抽屉会变成底部全屏。
    </p>

    <FbkProTable :columns="columns" :request="request" row-key="id" @row-click="openDetail" />

    <FbkDetailDrawer
      v-model:show="show"
      :request="fetchDetail"
      :items="detailItems"
      :title="(data: OrderDetail) => `订单 ${data.orderNo}`"
      @expand="onExpand"
    >
      <template #field-amount="{ value }">
        <span class="demo-amount">¥{{ Number(value).toFixed(2) }}</span>
      </template>

      <template #extra="{ data }">
        <p class="fbk-demo-note">
          这行来自 <code>#extra</code> 插槽：{{ data.address }}
        </p>
      </template>
    </FbkDetailDrawer>
  </div>
</template>

<style scoped>
.demo-amount {
  font-weight: var(--fbk-font-weight-semibold);
  color: var(--fbk-color-primary-text);
  font-variant-numeric: tabular-nums;
}
</style>
