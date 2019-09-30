<template>
  <div>
    <h1>Error</h1>
    <p>Details: {{ this.$route.path === '/squared' ? error.response.data : error.message }}</p>

    <nuxt-link to="/">
      back
    </nuxt-link>
  </div>
</template>

<script>
export default {
  layout: 'error-layout',
  // eslint-disable-next-line vue/require-prop-types
  props: ['error']
}
</script>
