<template>
  <div>You should not see this</div>
</template>

<script setup lang="ts">
definePageMeta({
  validate: to => ({
    status: 401,
    statusText: 'Custom error message',
  }),
})
</script>
