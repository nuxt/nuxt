<template>
  <div>You should not see this</div>
</template>

<script setup lang="ts">
definePageMeta({
  validate: to => ({
    statusCode: 401,
    statusMessage: 'Custom error message',
  }),
})
</script>
