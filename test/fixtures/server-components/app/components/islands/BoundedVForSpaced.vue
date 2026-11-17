<script setup lang="ts">
defineProps<{
  count: number
}>()
</script>

<template>
  <div>
    <!-- eslint-disable vue/no-spaces-around-equal-signs-in-attribute -->
    <span
      v-for = "n in count"
      :key="n"
      class="spaced-item"
    />
    <!-- eslint-enable vue/no-spaces-around-equal-signs-in-attribute -->
  </div>
</template>
