<template>
  <nuxt />
</template>

<script>
export default {
  created() {
    if (typeof window !== 'undefined') {
      // expose nuxt for e2e tests
      window.$nuxt = this.$root
    }
  }
}
</script>
