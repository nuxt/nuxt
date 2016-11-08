<template>
  <div class="container">
    <img :src="thumbnailUrl" />
    <p><router-link to="/">Home</router-link> - About</p>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data () {
    return axios.get('http://jsonplaceholder.typicode.com/photos/4').then(res => res.data)
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
