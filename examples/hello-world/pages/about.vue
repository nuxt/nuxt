<template>
  <div>
    <p>Hi from {{ mode }}</p>
    <NLink to="/">
      Home page
    </NLink>
    <nuxt-child :project="{ test: true }" />
    <button @click="changeMode">Force server mode</button>
    <hello v-if="mode === 'server'" :mode="mode" />
  </div>
</template>

<script>
import Placeholder from '~/components/placeholder'
import Hello from '~/components/hello'

export default {
  components: {
    Hello
  },
  placeholder: Placeholder,
  data() {
    return {
      showHello: false
    }
  },
  async asyncData(ctx) {
    await new Promise(resolve => setTimeout(resolve, 100))
    return {
      mode: process.static ? 'static' : (process.server ? 'server' : 'client')
    }
  },
  methods: {
    changeMode() {
      this.mode = 'server'
    }
  },
  head: {
    title: 'About page'
  }
}
</script>
