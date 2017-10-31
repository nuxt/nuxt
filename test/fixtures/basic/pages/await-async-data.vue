<template>
  <p>{{ name }}</p>
</template>

<script>
const fetchData = () => {
  return new Promise(resolve => {
    setTimeout(() => resolve({ name: 'Await Nuxt.js' }), 10)
  })
}

export default {
  async asyncData() {
    const data = await fetchData()
    return data
  }
}
</script>
