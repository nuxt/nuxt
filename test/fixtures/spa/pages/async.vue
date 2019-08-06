<template>
  <pre>
    {{ debug }}
  </pre>
</template>

<script>
export default {
  computed: {
    debug () {
      return JSON.stringify(this.$data, null, 2)
    }
  },
  asyncData () {
    return {
      [Math.random()]: true
    }
  }
}
</script>
