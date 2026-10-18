<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <section class="demo-block">
    <h3 v-if="title" class="demo-block__title">{{ title }}</h3>
    <slot />
  </section>
</template>
