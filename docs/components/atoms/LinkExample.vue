<template>
  <Alert type="info" icon="🔎">
    Read and edit a live example in <NuxtLink :to="link" v-text="computedTitle" />.
  </Alert>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api'
import createTitle from '~/utils/createTitle'

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
      return createTitle(this.title, this.link)
    }
  }
})
</script>
