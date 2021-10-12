<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div v-html="html" />
</template>

<script>
import { welcome as welcomeTemplate } from '@nuxt/design'
export default ({
  computed: {
    html: () => welcomeTemplate({})
  }
})
</script>
