<template>
  <div>
    Welcome to Nuxt Layouts 👋

    <NuxtLink to="/manual">
      Manual layout
    </NuxtLink>
    <NuxtLink to="/same">
      Same layout
    </NuxtLink>
  </div>
</template>

<script>
export default defineNuxtComponent({
  layout: 'custom'
})
</script>
