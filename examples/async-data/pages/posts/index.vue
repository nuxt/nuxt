
<template>
  <div class="container">
    <h1>Blog</h1>
    <ul>
      <li v-for="post in posts">
        <nuxt-link :to="{ name: 'posts-id', params: { id: post.id } }">{{ post.title }}</nuxt-link>
      </li>
    </ul>
    <p><nuxt-link to="/">Back to home page</nuxt-link></p>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  asyncData({ req, params }) {
    // We can return a Promise instead of calling the callback
    return axios.get('https://jsonplaceholder.typicode.com/posts')
      .then((res) => {
        return { posts: res.data.slice(0, 5) }
      })
  },
  head: {
    title: 'List of posts'
  }
}
</script>

<style scoped>
.container {
  width: 70%;
  margin: auto;
  text-align: center;
  padding-top: 100px;
}
ul {
  list-style-type: none;
  padding: 0;
}
ul li {
  border: 1px #ddd solid;
  padding: 20px;
  text-align: left;
}
ul li a {
  color: gray;
}
p {
  font-size: 20px;
}
a {
  color: #41B883;
}
</style>
