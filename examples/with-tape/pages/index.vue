<template>
  <div>
    <h1 :class="className">Hello {{ name }}!</h1>
    <button @click="changeColor()"> Change h1 Color </button>
  </div>
</template>

<script>
  export default {
    data() {
      return { name: 'world', className: 'red' }
    },
    methods: {
      changeColor() {
        this.className = this.className === 'red' ? 'blue' : 'green'
      }
    }
  }
</script>

<style>
  .red {
  	color: red;
  }
  .blue {
  	color: blue;
  }
  .green {
  	color: green;
  }
</style>
