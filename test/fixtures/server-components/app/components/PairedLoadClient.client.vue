<script setup lang="ts">
const count = ref(0)
</script>

<template>
  <div id="paired-load-client">
    PAIRED_LOAD_CLIENT_CLIENT_SENTINEL
    <button @click="count++">
      count: {{ count }}
    </button>
  </div>
</template>
