<template>
  <div>
    <h2>Child content</h2>
    ID:{{ id }}
  </div>
</template>

<script>
export default {
  name: 'Child',
  validate ({ params }) {
    return !isNaN(+params.id)
  },
  computed: {
    id () {
      return this.$route.params.id
    }
  }
}
</script>

<style scoped>

</style>
