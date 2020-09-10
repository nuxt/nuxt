<template>
  <button @click="$fetch">
    fetch {{ foo }}
  </button>
</template>

<script>
export default {
  async fetch () {
    await new Promise(resolve => setTimeout(resolve, 100))

    this.foo = this.$fetch ? 'has fetch' : 'hasn\'t fetch'
  },

  data () {
    return {
      foo: null
    }
  }
}
</script>
