<template>
  <div class="container">
    <img :src="thumbnailUrl" />
    <p><nuxt-link to="/">Home</nuxt-link> - About</p>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data () {
    return axios.get('https://jsonplaceholder.typicode.com/photos/4').then(res => res.data)
  }
}
</script>

<style>
.container {
  text-align: center;
  padding-top: 100px;
  font-family: sans-serif;
}
</style>
