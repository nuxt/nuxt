<template>
  <Alert icon="🧪">
    {{ title }} is available on edge channel. Check out the <Link to="/guide/going-further/edge-channel">
      Edge Channel Documentation
    </Link> to beta test.
  </Alert>
</template>

<script>
import { defineComponent } from '@nuxtjs/composition-api'

export default defineComponent({
  props: {
    title: {
      type: String,
      default: 'This feature'
    }
  }
})
</script>
