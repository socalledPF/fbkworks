<script setup lang="ts">
import { computed } from 'vue'
import { FbkResult } from '@fbk/components/result'
import { FbkPageContainer } from '@fbk/components/page-container'
import { navigate, route } from '../router'

/**
 * 异常页（403 / 404 / 500）。
 *
 * 检验 Result 组件的三种数字状态 + 操作区。
 */
const props = defineProps<{ kind: '403' | '404' | '500' }>()

const config = computed(() => {
  switch (props.kind) {
    case '403':
      return {
        status: '403' as const,
        title: '无访问权限',
        subtitle: '你的角色（运营）没有查看该页面的权限，请联系管理员开通。',
        primary: '返回工作台',
        primaryTo: '/',
      }
    case '500':
      return {
        status: '500' as const,
        title: '服务器开小差了',
        subtitle: '请稍后重试。如果问题持续存在，请联系技术支持并提供请求 ID。',
        primary: '重试',
        primaryTo: route.value,
      }
    default:
      return {
        status: '404' as const,
        title: '页面不存在',
        subtitle: '你访问的地址可能已被移除，或者链接本身有误。',
        primary: '返回工作台',
        primaryTo: '/',
      }
  }
})
</script>

<template>
  <FbkPageContainer>
    <FbkResult
      :status="config.status"
      :title="config.title"
      :subtitle="config.subtitle"
      :extra="`请求路径：${route}`"
    >
      <template #default>
        <button
          type="button"
          class="admin-btn admin-btn--primary"
          @click="navigate(config.primaryTo)"
        >
          {{ config.primary }}
        </button>
        <button type="button" class="admin-btn" @click="navigate('/')">回到首页</button>
      </template>
    </FbkResult>
  </FbkPageContainer>
</template>
