<template>
  <div>
    <button @click="$fetch">
      fetch {{ foo }}
    </button>
    <NuxtChild />
  </div>
</template>

<script>
export default {
  fetchKey (getCounter) {
    return 'ie' + getCounter('ie')
  },
  data () {
    return {
      foo: null
    }
  },
  async fetch () {
    await new Promise(resolve => setTimeout(resolve, 100))

    this.foo = this.$fetch ? 'has fetch' : 'hasn\'t fetch'
  }
}
</script>
