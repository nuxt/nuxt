<script setup lang="ts">
definePageMeta({
  pageTransition: { name: 'page', mode: 'out-in' },
})

useHead({
  style: [{ innerHTML: '.bg-red { background-color: rgb(255, 0, 0); }' }],
})
</script>

<template>
  <div class="bg-red red-page">
    <h1>red</h1>
    <NuxtLink
      id="to-blue"
      to="/page-transition-style/blue"
    >
      to blue
    </NuxtLink>
  </div>
</template>

<style>
.page-leave-active,
.page-enter-active {
  transition: opacity 500ms;
}
.page-leave-to,
.page-enter-from {
  opacity: 0;
}
</style>
