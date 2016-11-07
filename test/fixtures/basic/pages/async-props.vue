<template>
  <p>{{ name }}</p>
</template>

<script>
export default {
  data () {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ name: 'Kobe Bryant' }), 10)
    })
  }
}
</script>
