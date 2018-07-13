<template>
  <pre>{{ data }}</pre>
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
pre {
    background: #222;
    color: #eee;
    margin: 0;
    padding: 20px;
}
</style>
