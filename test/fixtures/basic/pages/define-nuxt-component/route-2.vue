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
    <h2>route-2</h2>
    <NuxtLink to="/define-nuxt-component/route-1">Go to route 1</NuxtLink>
    <div data-testid="define-nuxt-component-route-2-path">
      {{ path }}
    </div>
  </div>
</template>
