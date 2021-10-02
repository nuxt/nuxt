<template>
  <div>
    <Nuxt />
    {{ route.path }}
  </div>
</template>

<script>
import { useRoute } from '#app'
export default {
  setup () {
    const route = useRoute()
    console.log(route.path)
    return { route }
  }
}
</script>
