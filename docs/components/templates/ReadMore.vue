<template>
  <Alert icon="👉">
    Read more in <Link :to="link" v-text="computedTitle" />.
  </Alert>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api'
import { splitByCase, upperFirst } from 'scule'

export default defineComponent({
  props: {
    link: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: false
    }
  },
  computed: {
    computedTitle () {
      // Guess title from link!
      return this.title || this.link.split('/')
        .filter(Boolean).map(part => splitByCase(part).map(p => upperFirst(p)).join(' ')).join(' > ')
    }
  }
})
</script>
