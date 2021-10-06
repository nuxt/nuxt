<template>
  <div>Hello Vue {{ version }}!</div>
</template>

<script>
import { useMeta } from '#meta'

export default defineComponent({
  setup () {
    useMeta({ meta: [{ name: 'description', content: 'This is a page to demo Nuxt Bridge.' }] })
    return {
      version: ref('2')
    }
  },
  head: {
    title: 'Bridge test fixture'
  }
})
</script>
