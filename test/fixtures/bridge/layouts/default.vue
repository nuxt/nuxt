<template>
  <div>
    <Nuxt />
    <hr>
    Route: {{ route.path }}
  </div>
</template>

<script>
export default {
  setup () {
    const route = useRoute()
    return { route }
  }
}
</script>
