<script setup lang="ts">
import { ref } from 'vue'
import { useAdapter } from '@fbk/adapter-core'

/**
 * feedback 命令式 API 的验证页。
 * 直接调用 adapter.feedback，确认三个适配器都能真正弹出提示与确认框。
 */
const adapter = useAdapter()
const log = ref<string[]>([])

function record(text: string) {
  log.value = [text, ...log.value].slice(0, 5)
}

function onSuccess() {
  adapter.feedback.message.success('保存成功')
  record('success')
}

function onError() {
  adapter.feedback.message.error('操作失败')
  record('error')
}

function onWarning() {
  adapter.feedback.message.warning('请注意')
  record('warning')
}

function onInfo() {
  adapter.feedback.message.info('普通提示')
  record('info')
}

async function onConfirm() {
  const ok = await adapter.feedback.confirm('确定要删除这条记录吗？', {
    title: '删除确认',
    danger: true,
  })
  record(`confirm => ${ok}`)
}
</script>

<template>
  <div class="fbk-demo-stack" style="padding: var(--fbk-spacing-lg)">
    <div class="fbk-demo-actions">
      <button type="button" class="fbk-demo-btn" data-act="success" @click="onSuccess">成功提示</button>
      <button type="button" class="fbk-demo-btn" data-act="error" @click="onError">错误提示</button>
      <button type="button" class="fbk-demo-btn" data-act="warning" @click="onWarning">警告提示</button>
      <button type="button" class="fbk-demo-btn" data-act="info" @click="onInfo">普通提示</button>
      <button type="button" class="fbk-demo-btn" data-act="confirm" @click="onConfirm">确认框</button>
    </div>
    <!-- 没有记录时不渲染空块：空容器会留下一条突兀的灰条 -->
    <ul v-if="log.length" class="fbk-demo-output" style="list-style: none; margin: 0">
      <li v-for="(line, i) in log" :key="i" data-log>{{ line }}</li>
    </ul>
  </div>
</template>
