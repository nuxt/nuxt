<template>
  <div>
    <div class="big-block">
      big
    </div>
    <div class="big-block">
      page
    </div>
    <NuxtLink
      id="big-page-1"
      to="/big-page-1"
    >
      to big page 1
    </NuxtLink>
    <NuxtLink
      id="big-page-2"
      to="/big-page-2"
    >
      to big page 2
    </NuxtLink>
    <NuxtLink
      id="big-page-2-test-test"
      to="/big-page-2?test=test"
    >
      to big page 2 with ?test=test
    </NuxtLink>
    <NuxtLink
      id="big-page-2-test-super-test"
      to="/big-page-2?test=super-test"
    >
      to big page 2 with ?test=super-test
    </NuxtLink>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
})
</script>

<style scoped>
.big-block {
    height: 90vh;
    width: 100vw;
    background-color: brown;
}
</style>
