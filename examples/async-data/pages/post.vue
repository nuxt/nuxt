
<template>
  <div>
    <p>{{ post.title }}!</p>
    <p><router-link to="/">Back home</router-link></p>
  </div>
</template>

<script>
const axios = require('axios')

export default {
  async data ({ req }) {
    const res = await axios.get('https://jsonplaceholder.typicode.com/posts/1')
    return { post: res.data }
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
