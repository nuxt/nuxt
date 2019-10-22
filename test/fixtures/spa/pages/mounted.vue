<template>
  <h1>Test: {{ test.text }}</h1>
</template>

<script>
export default {
  data () {
    return {
      test: {
        text: null
      }
    }
  },
  mounted () {
    this.test = {
      text: 'updated'
    }
  }
}
</script>
