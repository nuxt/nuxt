<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <main>
    <p data-testid="query">Query preview: {{ route.query.preview }}</p>
    <div
      data-testid="mode"
      :class="route.query.preview === 'true' ? 'preview-mode' : 'normal-mode'"
    >
      This should have red background when ?preview=true
    </div>
  </main>
</template>

<style scoped>
.preview-mode {
  background: red;
}

.normal-mode {
  background: blue;
}
</style>
