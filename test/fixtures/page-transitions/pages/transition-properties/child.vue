<template>
  <div>
    <h1>Transition name child page</h1>
  </div>
</template>

<script>
export default {
  transition: {
    name: 'custom-child'
  }
}
</script>
<style>
  .custom-child-enter-active, .custom-child-leave-active {
    transition: opacity 1s ease;
  }
</style>
