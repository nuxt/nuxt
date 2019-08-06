<template>
  <p>{{ name }}</p>
</template>

<script>
export default {
  asyncData (context, callback) {
    setTimeout(function () {
      callback(null, { name: 'Callback Nuxt.js' })
    }, 10)
  }
}
</script>
