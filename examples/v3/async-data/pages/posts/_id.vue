<template>
  <div>
    <h1>{{ post.title }}</h1>
    <author :user-id="post.userId" />
    <pre>{{ post.body }}</pre>
    <p><n-link to="/">Home</n-link></p>
    <p><n-link :to="{ name: 'posts-id', params: { id: (post.id + 1) } }">Next article</n-link></p>
  </div>
</template>

<script>
import Author from '~/components/Author.vue'

export default {
  components: {
    Author
  },
  head() {
    return { title: this.post.title }
  },
  async asyncData({ params }) {
    const post = await fetch(`https://jsonplaceholder.typicode.com/posts/${params.id}`).then((res) => res.json())

    return { post }
  }
}
</script>
