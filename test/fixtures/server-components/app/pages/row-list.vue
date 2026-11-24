<script setup lang="ts">
const route = useRoute()
const rows = Number(route.query.rows) || 0
</script>

<template>
  <RowList :rows="rows" />
</template>
