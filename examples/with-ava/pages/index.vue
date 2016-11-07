<template>
  <div>
    <p class="red-color">Hello {{ name }}!</p>
  </div>
</template>

<script>
export default {
  data () {
    return { name: 'world' }
  }
}
</script>

<style>
.red-color {
  color: red;
}
</style>
