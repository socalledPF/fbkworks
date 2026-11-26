<script setup lang="ts">
import { FbkDetailPage } from '@fbkworks/components/detail-page'
import type { DescriptionItem } from '@fbkworks/components/descriptions'
import { fetchProduct, PRODUCT_STATUS_MAP, type ProductRow } from '../product-api'

/**
 * 详情页 = DetailPage + 一份字段描述。
 *
 * 加载态 / 错误态 / 404 都由组件负责（request 返回 null 即 404），
 * 页面只剩「这些字段怎么显示」这一件事 —— 不用手写 v-if 三态。
 */
const props = defineProps<{ id: number }>()

const items: DescriptionItem<ProductRow>[] = [
  { key: 'sku', label: 'SKU', dataIndex: 'sku' },
  { key: 'name', label: '商品名', dataIndex: 'name' },
  { key: 'category', label: '分类', dataIndex: 'category' },
  { key: 'price', label: '价格', getValue: (row) => '¥' + row.price.toFixed(2) },
  { key: 'stock', label: '库存', dataIndex: 'stock' },
  { key: 'status', label: '状态', getValue: (row) => PRODUCT_STATUS_MAP[row.status].text },
  {
    key: 'createdAt',
    label: '上架时间',
    getValue: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
  { key: 'remark', label: '备注', getValue: (row) => row.remark || '—', span: 2 },
]

/** 返回列表：模板不引路由库，hash 就是路由 */
function goList() {
  window.location.hash = '/'
}
</script>

<template>
  <FbkDetailPage
    :request="() => fetchProduct(props.id)"
    :items="items"
    :title="(data: ProductRow) => data.name"
    :subtitle="'商品 #' + props.id"
    :breadcrumbs="[{ text: '商品列表', to: '/' }, { text: '商品详情' }]"
    back
    bordered
    @back="goList"
  >
    <template #actions="{ data }">
      <button type="button" class="app-btn" @click="goList">返回列表</button>
      <span class="app-hint">当前商品：{{ data.sku }}</span>
    </template>
  </FbkDetailPage>
</template>
