<template>
  <h2>Id={{ id }}</h2>
</template>

<script>
export default {
  async asyncData({ route }) {
    const asyncData = {}

    await new Promise((resolve, reject) => {
      setTimeout(() => {
        asyncData.id = route.params.id
        resolve()
      }, 50)
    })

    return asyncData
  }
}
</script>
