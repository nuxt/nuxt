<template>
  <p>{{ name }}</p>
</template>

<script>
export default {
  asyncData () {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ name: 'Nuxt' }), 10)
    })
  }
}
</script>
