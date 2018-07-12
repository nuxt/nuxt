<template>
  <p v-html="data"/>
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
