<script setup lang="ts">
import { ref } from 'vue'
import { FbkCrudPage } from '@fbkworks/components/crud-page'
import { FbkFormModal } from '@fbkworks/components/form-modal'
import { FbkDetailDrawer } from '@fbkworks/components/detail-drawer'
import type { FormSchema } from '@fbkworks/components/form-generator'
import type { DescriptionItem } from '@fbkworks/components/descriptions'
import { formFields, queryFields, toTableColumns } from '../product-fields'
import {
  deleteProducts,
  fetchProduct,
  fetchProducts,
  PRODUCT_STATUS_MAP,
  saveProduct,
  type ProductRow,
} from '../product-api'

/**
 * 列表页 = CrudPage（查询 + 表格 + 分页 + 请求联动）+ FormModal（新建/编辑）+ DetailDrawer（快速预览）。
 *
 * 这里没有一行「联动代码」：查询区提交、重置页码、排序、翻页都在 CrudPage 里，
 * 页面只剩下三件事 —— 字段从哪来、数据从哪来、按钮点了做什么。
 */
const crudRef = ref<any>(null)

const formSchema: FormSchema<ProductRow> = { fields: formFields, labelWidth: 90 }

/* ---------- 新建 / 编辑 ---------- */

const modalVisible = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
/** edit 模式回填的数据；create 模式读下面的默认值 */
const editing = ref<Partial<ProductRow>>({})
/* create 的默认值必须走 defaultValues 而不是 initialValues ——
   后者只在编辑回填时读，写在里面弹窗会永远空白打开。
   另外别给数字字段写 0 当前值：实测（element-plus 2.14）新建弹窗里
   库存预填 0 时点确定会报「库存不能为空」，而输入框里明明写着 0 ——
   用户只会怀疑自己。要默认零值就留空、由用户填。 */
const createDefaults: Partial<ProductRow> = { status: 'on', category: '数码' }

function openCreate() {
  modalMode.value = 'create'
  modalVisible.value = true
}

function openEdit(row: ProductRow) {
  modalMode.value = 'edit'
  editing.value = { ...row }
  modalVisible.value = true
}

async function onSubmit(values: Record<string, any>) {
  await saveProduct(values as Partial<ProductRow>)
  // 成功返回后 FormModal 自己关闭并发 success
}

/** 新建后新行在最前面，停在别的页就看不到它 —— 只有新建需要回第 1 页 */
async function onFormSuccess() {
  await crudRef.value?.refresh()
}

/* ---------- 删除 ---------- */

async function onDelete(row: ProductRow) {
  await deleteProducts([row.id])
  await crudRef.value?.refresh()
}

/* ---------- 详情抽屉 ---------- */

const drawerVisible = ref(false)
const drawerId = ref(0)

/** 抽屉是「快速看几眼」，整页详情见 segments /detail/:id */
const drawerItems: DescriptionItem<ProductRow>[] = [
  { key: 'sku', label: 'SKU', dataIndex: 'sku' },
  { key: 'category', label: '分类', dataIndex: 'category' },
  { key: 'price', label: '价格', getValue: (row) => `¥${row.price.toFixed(2)}` },
  { key: 'stock', label: '库存', dataIndex: 'stock' },
  { key: 'status', label: '状态', getValue: (row) => PRODUCT_STATUS_MAP[row.status].text },
  { key: 'remark', label: '备注', getValue: (row) => row.remark || '—' },
]

function openDetail(row: ProductRow) {
  drawerId.value = row.id
  drawerVisible.value = true
}

/* ---------- 表格 ---------- */

/* 业务字段的列全部来自同一份定义（src/product-fields.ts）。
   「操作」列不属于任何数据字段，所以只有这一列是手写的 —— 这也正是它该在的位置。 */
const columns = [
  ...toTableColumns(),
  {
    key: 'actions',
    title: '操作',
    width: 150,
    fixed: 'right',
    valueType: 'actions',
    actions: [
      { key: 'detail', text: '详情', variant: 'link', onClick: ({ row }: any) => openDetail(row) },
      { key: 'edit', text: '编辑', variant: 'link', onClick: ({ row }: any) => openEdit(row) },
      {
        key: 'delete',
        text: '删除',
        variant: 'link',
        status: 'danger',
        confirm: '确定删除该商品？',
        onClick: ({ row }: any) => onDelete(row),
      },
    ],
  },
]
</script>

<template>
  <section class="page">
    <header class="page__head">
      <h1 class="page__title">商品列表</h1>
      <p class="page__desc">
        查询、表格、分页、表单、详情 —— 字段定义只有一份（<code>src/product-fields.ts</code>）。
      </p>
    </header>

    <FbkCrudPage
      ref="crudRef"
      :query-fields="queryFields"
      :columns="columns"
      :request="fetchProducts"
      row-key="id"
    >
      <template #toolbar>
        <button type="button" class="app-btn app-btn--primary" @click="openCreate">新建商品</button>
      </template>
    </FbkCrudPage>

    <FbkFormModal
      v-model:show="modalVisible"
      :mode="modalMode"
      :title="modalMode === 'create' ? '新建商品' : '编辑商品'"
      :schema="formSchema"
      :initial-values="editing"
      :default-values="createDefaults"
      :submit="onSubmit"
      @success="onFormSuccess"
    />

    <FbkDetailDrawer
      v-model:show="drawerVisible"
      :request="() => fetchProduct(drawerId)"
      :items="drawerItems"
      :title="(data: ProductRow) => data.name"
      :column="1"
    >
      <template #actions="{ data }">
        <button type="button" class="app-btn" @click="openEdit(data)">编辑</button>
        <button type="button" class="app-btn app-btn--danger" @click="onDelete(data)">删除</button>
      </template>
    </FbkDetailDrawer>
  </section>
</template>
