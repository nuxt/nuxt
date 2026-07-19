<script setup lang="ts">
const data = await new Promise<{ content: string }>((resolve) => {
  setTimeout(() => resolve({ content: 'inner-loaded' }), 50)
})
</script>

<template>
  <div id="issue-25317-inner-loaded">
    {{ data.content }}
  </div>
</template>
