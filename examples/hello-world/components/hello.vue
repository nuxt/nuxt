<template>
  <div>
    <pre>dataFn {{ dataFn }}</pre>
    <pre>hello {{ hello }}</pre>
    <pre>mode {{ mode }}</pre>
  </div>
</template>

<script>
export default {
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
    await new Promise(resolve => setTimeout(resolve, 100))
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
