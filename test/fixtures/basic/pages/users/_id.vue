<template>
  <div>
    <h1>User: {{ id }}</h1>
    <h2>Type: {{ typeof numericId }}</h2>
    <h3>Plus One: {{ numericId + 1 }}</h3>
  </div>
</template>

<script>
export default {
  props: ['numericId'],
  routeToProps (route) {
    return {
      numericId: parseInt(route.params.id)
    }
  },
  asyncData({ params, payload }) {
    if (payload) return payload
    return { id: params.id }
  }
}
</script>
