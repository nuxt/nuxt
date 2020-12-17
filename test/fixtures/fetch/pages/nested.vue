<template>
  <div>
    fizz-{{ foo }}
    <NuxtChild />
  </div>
</template>

<script>
export default {
  data () {
    return {
      foo: 'bar'
    }
  },
  async fetch () {
    await new Promise((resolve) => {
      this.foo = 'buzz'
      resolve()
    })
  }
}
</script>
