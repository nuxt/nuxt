
<template>
  <div>
    <p>{{ post.title }}!</p>
    <post post-id="1" />
    <post post-id="2" />
    <p><nuxt-link to="/">Back home</nuxt-link></p>
  </div>
</template>

<script>
const axios = require('axios')
import Post from '~components/post'

export default {
  data ({ req }) {
    // We can return a Promise instead of calling the callback
    return axios.get('https://jsonplaceholder.typicode.com/posts/1')
    .then((res) => {
      return { post: res.data }
    })
  },
  head () {
    return {
      title: this.post.title
    }
  },
  components: {
    Post
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
