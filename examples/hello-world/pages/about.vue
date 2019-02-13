<template>
  <div>
    <p>Hi from {{ n }}</p>
    <NLink to="/">
      Home page
    </NLink>
    <hello :foo="n"/>
  </div>
</template>

<script>
import Hello from '~/components/hello'

export default {
  components: {
    Hello
  },
  async asyncData(ctx) {
    console.log('async Data about')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      n: process.static ? 'static' : (process.server ? 'server' : 'client')
    }
  },
  head: {
    title: 'About page'
  }
}
</script>
