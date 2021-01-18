<template>
  <RouterView v-slot="{ Component }">
    <transition name="page" mode="out-in">
        <component :is="Component" :key="$route.path" />
    </transition>
  </RouterView>
</template>

<script>
export default {
  name: 'NuxtChild'
}
</script>
