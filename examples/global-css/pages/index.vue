<template>
  <p>Hello {{ name }}!</p>
</template>

<script>
export default {
  data () {
    return { name: 'world' }
  }
}
</script>

<style>
p {
  font-size: 20px;
  text-align: center;
  padding: 100px;
}
</style>
