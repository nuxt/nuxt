<template>
  <div>
    <h1>I am the {{ name }}</h1>
    <NuxtChild />
  </div>
</template>

<script>
export default {
  async asyncData ({ route }) {
    const asyncData = {}

    await new Promise((resolve, reject) => {
      setTimeout(() => {
        asyncData.name = 'parent'
        resolve()
      }, 100)
    })

    return asyncData
  }
}
</script>
