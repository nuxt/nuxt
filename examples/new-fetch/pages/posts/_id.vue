<template>
  <div>
    <button @click="$fetch">
      Refresh
    </button>
    <template v-if="$fetchState.pending">
      <content-placeholders>
        <content-placeholders-heading />
        <content-placeholders-text :lines="10" />
      </content-placeholders>
    </template>
    <template v-else-if="$fetchState.error">
      <h1>
        Post #{{ $route.params.id }} not found
      </h1>
    </template>
    <template v-else>
      <h1>{{ post.title }}</h1>
      <author :user-id="post.userId" />
      <pre>{{ post.body }}</pre>
      <p>
        <n-link :to="{ name: 'posts-id', params: { id: (post.id + 1) } }">
          Next article
        </n-link>
      </p>
    </template>
    <p>
      <n-link to="/">
        Home
      </n-link>
    </p>
  </div>
</template>

<script>
import Author from '~/components/Author.vue'

export default {
  components: {
    Author
  },
  async fetch () {
    this.post = await this.$http.$get(`https://jsonplaceholder.typicode.com/posts/${this.$route.params.id}`)
  },
  data () {
    return {
      post: {}
    }
  },
  head () {
    return { title: this.post.title }
  }
}
</script>
