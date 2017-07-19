<template>
  <p v-html="data"></p>
</template>

<script>
export default {
  props: {
    data: String
  }
}
</script>

<style scoped>
p {
  padding: 5px 20px;
}
</style>