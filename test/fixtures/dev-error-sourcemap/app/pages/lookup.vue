<script setup lang="ts">
const error = new Error(`no item named ${useRoute().query.id}`)
void error.stack
error.message = 'no item found'
throw error
</script>

<template>
  <div>lookup</div>
</template>
