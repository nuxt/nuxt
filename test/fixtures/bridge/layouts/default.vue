<template>
  <div>
    <Nuxt />
    {{ route.path }}
  </div>
</template>

<script>
export default {
  setup () {
    const route = useRoute()
    console.log(route.path)
    return { route }
  }
}
</script>
