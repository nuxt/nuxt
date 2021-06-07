<template>
  <nuxt-link to="/getting-started/intro">
    Getting Started
  </nuxt-link>
</template>

<script>
export default {
  asyncData ({ redirect }) {
    redirect('/getting-started/intro')
    return {}
  }
}
</script>
