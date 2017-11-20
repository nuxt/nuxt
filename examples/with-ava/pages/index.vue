<template>
  <h1 class="red">Hello {{ name }}!</h1>
</template>

<script>
export default {
  data() {
    return { name: 'world' }
  }
}
</script>

<style>
.red {
  color: red;
}
</style>
