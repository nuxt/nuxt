<template>
  <div>
    <h1>Dog</h1>
    <img :src="dog" />
  </div>
</template>

<script>

export default {

  async asyncData({ app }) {
    const { data: { message: dog } } = await app.$axios.get('/dog')
    return { dog }
  }
}
</script>
