<script setup>
useHead({
  title: 'First Page',
})
</script>

<template>
  <div>
    <NuxtLink
      role="link"
      to="/route-announcer2"
    >
      Link
    </NuxtLink>
    <button
      role="button"
      @click="() => useHead({ title: 'Dynamically set title' })"
    >
      Button
    </button>
  </div>
</template>
