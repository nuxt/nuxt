<template>
  <div class="main">
    <h1 class="title">
      {{ title }}
    </h1>
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.main {
  font: 15px Helvetica, Arial;
  border: 1px solid #eee;
  padding: 0 10px;
}
.title {
  font-size: 16px;
  font-weight: bold;
  margin: 10px 0
}
</style>
