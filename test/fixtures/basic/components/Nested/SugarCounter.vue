<script setup lang="ts">
defineProps({
  count: Number
})
</script>

<template>
  <div>
    <SugarCounter :count="count" />
  </div>
</template>
