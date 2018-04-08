<template>
  <div>
    <h2>Id={{ id }},IdType={{ typeof numericId }},NumericId={{ numericId }}</h2>
  </div>
</template>

<script>
export default {
  props: ['numericId'],
  routeToProps(route) {
    return {
      numericId: parseInt(route.params.id)
    }
  },
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
