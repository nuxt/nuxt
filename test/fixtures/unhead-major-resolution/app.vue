<script setup>
const title = ref('Nuxt-owned Unhead')

useHead({
  title,
  style: [{
    id: 'nuxt-owned-unhead',
    textContent: ':root { --nuxt-owned-unhead: true; }',
  }],
})

onMounted(() => {
  title.value = 'Nuxt-owned Unhead hydrated'
})
</script>

<template>
  <div>Nuxt-owned Unhead</div>
</template>
