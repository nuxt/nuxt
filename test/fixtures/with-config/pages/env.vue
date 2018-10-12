<template>
  <div>
    <pre>{{ env }}</pre>
    <p>object:</p>
    <pre>{{ processEnv }}</pre>
    <nuxt-link to="/">Home</nuxt-link>
  </div>
</template>

<script>
export default {
  layout: 'custom-env',
  data() {
    return { processEnv: process.env.object }
  },
  asyncData({ env }) {
    delete env.object
    return { env }
  }
}
</script>
