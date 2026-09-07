<script setup lang="ts">
defineProps<{
  count: number
}>()
</script>

<template>
  <div>
    <span
      v-for="n in count"
      :key="n"
      class="plain-item"
    />
    <slot
      v-for="n in count"
      :key="n"
      name="loop"
      :n="n"
    >
      <b class="slot-item" />
    </slot>
  </div>
</template>
