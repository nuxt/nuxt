<template>
  <p>{{ name }}</p>
</template>

<script>
export default {
  async asyncData(context, callback) {
    setTimeout(function () {
      callback(null, { name: 'Callback Nuxt.js' })
    }, 10)
  }
}
</script>
