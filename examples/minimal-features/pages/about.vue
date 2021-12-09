<template>
  <div>
    <p>Hi from {{ name }}</p>
    <nuxt-link to="/">
      Home page EDITED
    </nuxt-link>
  </div>
</template>

<script>
export default {
  data () {
    return {
      name: process.static ? 'static' : (process.server ? 'server' : 'client')
    }
  },
  head: {
    title: 'About page'
  }
}
</script>
