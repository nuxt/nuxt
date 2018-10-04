<template>
  <h1>User: {{ id }}</h1>
</template>

<script>
export default {
  asyncData({ params, payload }) {
    if (payload) return payload
    return { id: params.id }
  }
}
</script>
