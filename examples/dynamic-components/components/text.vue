<template>
  <p>
    {{ data }}
  </p>
</template>

<script>
export default {
  props: {
    data: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
p {
  padding: 5px 20px;
}
</style>
