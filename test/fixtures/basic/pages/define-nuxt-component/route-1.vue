<script lang="ts">
export default defineNuxtComponent({
  name: 'DefineNuxtComponentTest',
  setup () {
    const route = useRoute()
    const path = route.path.toString()

    return {
      path,
    }
  },
})
</script>

<template>
  <div>
    <h1>route-1</h1>
    <NuxtLink to="/define-nuxt-component/route-2">Go to route 2</NuxtLink>
    <div data-testid="define-nuxt-component-route-1-path">
      {{ path }}
    </div>
  </div>
</template>
