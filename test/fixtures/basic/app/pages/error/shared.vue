<template>
  <div>should not render</div>
</template>

<script lang="ts">
const sharedError = createError({ status: 418, statusText: 'Shared error' })
</script>

<script setup lang="ts">
useCookie('shared-error-who').value = String(useRoute().query.who)
throw sharedError
</script>
