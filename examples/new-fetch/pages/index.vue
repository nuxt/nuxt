<template>
  <div>
    <h1>Blog posts</h1>
    <Promised :promise="$fetchPromise">
      <content-placeholders v-if="$isFetching">
        <content-placeholders-text :lines="20" />
      </content-placeholders>
      <p v-else-if="$fetchError">Error while fetching posts: {{ $fetchError.message }}</p>
      <ul v-else>
        <li v-for="post of posts" :key="post.id">
          <n-link :to="`/posts/${post.id}`">{{ post.title }}</n-link>
        </li>
        <li>
          <n-link to="/posts/not-found">404 post</n-link>
        </li>
      </ul>
    </Promised>
  </div>
</template>

<script>
export default {
  data () {
    return {
      posts: null
    }
  },
  async fetch() {
    this.posts = await this.$http.$get('https://jsonplaceholder.typicode.com/posts')
      .then(posts => posts.slice(0, 20))
  }
}
</script>
