<script setup lang="ts">
const list = ['a', 'b', 'c']
const templateRef = ref<HTMLElement[] | null>(null)
</script>

<template>
  <div>
    <div
      v-for="item in list"
      ref="templateRef"
      :key="item"
    >
      {{ item }}
    </div>
  </div>
</template>
