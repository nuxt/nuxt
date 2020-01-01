<template>
  <pre>
    {{ debug }}
  </pre>
</template>

<script>
export default {
  asyncData () {
    return {
      [Math.random()]: true
    }
  },
  computed: {
    debug () {
      return JSON.stringify(this.$data, null, 2)
    }
  }
}
</script>
