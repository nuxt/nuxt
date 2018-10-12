<template>
  <p>{{ name }}</p>
</template>

<script>
export default {
  asyncData() {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ name: 'Nuxt.js' }), 10)
    })
  }
}
</script>
