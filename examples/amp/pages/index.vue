<template>
  <div>
    <h1>Welcome!</h1>
    <nuxt-link to="/about">About page</nuxt-link>
    <byline author="Pete Johanson"></byline>
  </div>
</template>

<script>
import Byline from '~/components/Byline'
export default {
  components: { Byline },
  head: {
    link: [
      { rel: 'canonical', href: 'http://localhost:3000/?html' }
    ]
  }
}
</script>
