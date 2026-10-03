<script setup lang="ts">
definePageMeta({
  pageTransition: { name: 'page', mode: 'out-in' },
})

useHead({
  style: [{ innerHTML: '.bg-blue { background-color: rgb(0, 0, 255); }' }],
})
</script>

<template>
  <div class="bg-blue blue-page">
    <h1>blue</h1>
    <NuxtLink
      id="to-red"
      to="/page-transition-style/red"
    >
      to red
    </NuxtLink>
  </div>
</template>
