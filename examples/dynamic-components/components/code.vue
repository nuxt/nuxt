<template>
  <pre>{{ data }}</pre>
</template>

<script>
export default {
  props: {
    data: String
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