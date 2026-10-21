<script setup lang="ts">
import { ref } from 'vue'
import { FbkResult } from '@fbk/components/result'
import type { ResultStatus } from '@fbk/components/result'

/**
 * 异常状态页。纯展示组件，不依赖适配器 ——
 * 切换 adapter 时这个 demo 的外观完全不变，这本身就是架构的证明。
 */
const statuses: ResultStatus[] = ['success', 'warning', 'error', 'info', '403', '404', '500']
const current = ref<ResultStatus>('404')
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 16px">
    <div style="display: flex; gap: 8px; flex-wrap: wrap">
      <button
        v-for="status in statuses"
        :key="status"
        type="button"
        :data-status-btn="status"
        :style="{ fontWeight: current === status ? 600 : 400 }"
        @click="current = status"
      >
        {{ status }}
      </button>
    </div>

    <FbkResult :status="current" extra="Trace ID: 7f3a9c2e-1b4d">
      <template #actions>
        <button type="button" data-act="back">返回首页</button>
        <button type="button" data-act="retry">重试</button>
      </template>
    </FbkResult>
  </div>
</template>
