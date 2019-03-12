<template>
  <div>
    <h1>Blog posts</h1>
    <div>
      <ul>
        <li v-for="post of posts" :key="post.id">
          <n-link :to="`/posts/${post.id}`">{{ post.title }}</n-link>
        </li>
      </ul>
      <n-link :to="{ query: { page: this.page - 1 }}" v-if="this.page > 1">Prev</n-link> -
      <n-link :to="{ query: { page: this.page + 1 }}" v-if="this.page < 5">Next</n-link>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ query }) {
    const page = Number(query.page) || 1
    const limit = 20
    const offset = (page -1) * limit

    const posts = await fetch('https://jsonplaceholder.typicode.com/posts').then((res) => res.json()).then(d => d.slice(offset, offset + limit))

    return { posts, page, limit }
  }
}
</script>
