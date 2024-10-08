<script setup lang="ts">
const wasPrerendered = useState(() => import.meta.prerender)
</script>

<template>
  <div>
    should be prerendered: {{ wasPrerendered }}
  </div>
</template>
