<template>
  <nuxt-link to="/get-started/installation">
    Getting Started
  </nuxt-link>
</template>

<script>
export default {
  asyncData ({ redirect }) {
    redirect('/get-started/installation')
    return {}
  }
}
</script>
