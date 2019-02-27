<template>
  <div>
    <p>Hi from {{ mode }}</p>
    <NLink to="/">
      Home page
    </NLink>
    <nuxt-child :project="{ test: true }" />
    <hello :mode="mode" />
  </div>
</template>

<script>
import Hello from '~/components/hello'

export default {
  components: {
    Hello
  },
  data() {
    return {
      showHello: false
    }
  },
  async asyncData(ctx) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      mode: process.static ? 'static' : (process.server ? 'server' : 'client')
    }
  },
  head: {
    title: 'About page'
  }
}
</script>
