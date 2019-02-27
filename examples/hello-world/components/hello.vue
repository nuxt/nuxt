<template>
  <div>
    <pre>dataFn {{ dataFn }}</pre>
    <pre>hello {{ hello }}</pre>
    <pre>mode {{ mode }}</pre>
  </div>
</template>

<script>
import Placeholder from '~/components/placeholder'

export default {
  placeholder: Placeholder,
  props: {
    mode: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      dataFn: 'done'
    }
  },
  async asyncData() {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return {
      hello: 'pouet',
      dataFn: this.dataFn
    }
  },
  async fetch() {
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}
</script>
