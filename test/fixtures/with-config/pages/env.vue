<template>
  <div>
    <pre>{{ env }}</pre>
    <p>object:</p>
    <pre>{{ processEnv }}</pre>
    <NuxtLink to="/">
      Home
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: 'custom-env',
  asyncData ({ env }) {
    delete env.object
    return { env }
  },
  data () {
    return { processEnv: process.env.object }
  }
}
</script>
