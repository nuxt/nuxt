<template>
  <RouterView v-slot="{ Component }">
    <transition name="page" mode="out-in">
      <!-- <keep-alive> -->
      <Suspense @pending="$nuxt.callHook('page:start')" @resolve="$nuxt.callHook('page:finish')">
        <component :is="Component" :key="$route.path" />
      </Suspense>
      <!-- <keep-alive -->
    </transition>
  </RouterView>
</template>

<script>
export default {
  name: 'NuxtPage'
}
</script>
