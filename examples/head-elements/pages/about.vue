<template>
  <div class="container">
    <h1>About page</h1>
    <router-link to="/">Go to /</router-link>
    <twitter-head></twitter-head>
  </div>
</template>

<script>
import TwitterHead from '../components/twitter-head.vue'

export default {
  head: {
    title: 'About 2',
    meta: [
      { hid: 'description', name: 'description', content: 'About page description' }
    ]
  },
  components: {
    TwitterHead
  }
}
</script>

<style>
.container {
  text-align: center;
  margin-top: 150px;
  font-size: 20px;
}
</style>
