<template>
  <RouterView v-slot="{ Component }">
    <component :is="Component" :key="$route.path" />
  </RouterView>
</template>

<script>
export default {
  name: 'NuxtNestedPage'
}
</script>
