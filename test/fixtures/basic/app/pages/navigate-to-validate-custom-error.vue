<template>
  <div>
    <div>navigate-to-validate-custom-error.vue</div>
    <NuxtLink to="/validate-custom-error">
      should throw a 401 error with custom message
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['override'],
})
</script>
