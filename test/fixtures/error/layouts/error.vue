<template>
  <div>
    <h1>Error</h1>
    <p>Details: {{ errorData }}</p>

    <nuxt-link to="/">
      back
    </nuxt-link>
  </div>
</template>

<script>
export default {
  // eslint-disable-next-line vue/require-prop-types
  props: ['error'],
  computed: {
    errorData () {
      if (['/squared'].includes(this.$route.path)) {
        return this.error.response.data
      }

      return this.error.message
    }
  }
}
</script>
