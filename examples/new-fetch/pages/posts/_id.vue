<template>
  <div>
    <button @click="$fetch">Refresh</button>
    <content-placeholders v-if="$isFetching">
      <content-placeholders-heading />
      <content-placeholders-text :lines="10" />
    </content-placeholders>
    <h1 v-else-if="$fetchError">Post #{{ $route.params.id }} found</h1>
    <div v-else>
      <h1>{{ post.title }}</h1>
      <author :user-id="post.userId" />
      <pre>{{ post.body }}</pre>
      <p><n-link :to="{ name: 'posts-id', params: { id: (post.id + 1) } }">Next article</n-link></p>
    </div>
    <p><n-link to="/">Home</n-link></p>
  </div>
</template>

<script>
import Author from '~/components/Author.vue'

export default {
  components: {
    Author
  },
  head () {
    return { title: this.post.title }
  },
  data () {
    return {
      post: {}
    }
  },
  async fetch() {
    this.post = await this.$http.$get(`https://jsonplaceholder.typicode.com/posts/${this.$route.params.id}`)
  }
}
</script>
