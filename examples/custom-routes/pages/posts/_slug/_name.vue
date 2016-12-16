<template>
  <div class="container">
    <h2>{{ $route.params.name }}</h2>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
    </p>
  </div>
</template>

<script>
export default {
  transition: {
    name: 'bounce',
    // css: true,
    beforeEnter (el) {
      console.log('Before enter');
    },
    enter (el) {
      console.log('Enter')
      // done()
    },
    afterEnter (el) {
      console.log('After enter')
    },
    enterCancelled (el) {
      console.log('Enter cancelled')
    },
    beforeLeave (el) {
      console.log('Before leave')
    },
    leave (el) {
      console.log('Leave')
      // done()
    },
    afterLeave (el) {
      console.log('After leave')
    },
    leaveCancelled (el) {
      console.log('Leave cancelled')
    }
  }
}
</script>

<style scoped>
p
{
  text-align: center;
  padding: 15px 30px;
}
</style>
