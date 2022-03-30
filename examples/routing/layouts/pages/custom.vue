<template>
  <div class="p-4">
    Custom layout defined with <code>definePageMeta</code>
    <br>
    <NuxtLink to="/">
      Back to home
    </NuxtLink>
  </div>
</template>

<script>
definePageMeta({
  layout: 'custom'
})
</script>
