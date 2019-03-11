<template>
  <div>
    <h1>Blog posts</h1>
    <p v-if="$isFetching">Fetching posts...</p>
    <ul v-else>
      <li v-for="post of posts" :key="post.id">
        <n-link :to="`/posts/${post.id}`">{{ post.title }}</n-link>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  data () {
    return {
      posts: []
    }
  },
  async fetch() {
    this.posts = await fetch('https://jsonplaceholder.typicode.com/posts').then((res) => res.json()).then(d => d.slice(0, 20))
  }
}
</script>
