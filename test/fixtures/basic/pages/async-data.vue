<template>
  <p>{{ name }}</p>
</template>

<script>
export default {
  data () {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ name: 'Nuxt.js' }), 10)
    })
  }
}
</script>
