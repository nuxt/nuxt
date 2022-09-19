<template>
  <div>You should not see me</div>
</template>

<script setup>
definePageMeta({
  middleware: () => {
    return navigateTo({ path: '/' }, { redirectCode: 307 })
  }
})
</script>
