
<template>
  <div>
    <p>{{ post.title }}!</p>
    <p><router-link to="/">Back home</router-link></p>
  </div>
</template>

<script>
const axios = require('axios')

export default {
  data ({ req }) {
    return axios.get('https://jsonplaceholder.typicode.com/posts/1')
    .then((res) => {
      return { post: res.data }
    })
  }
}
</script>

<style scoped>
p {
  font-size: 20px;
  text-align: center;
  padding: 100px;
  padding-bottom: 0;
}
</style>
