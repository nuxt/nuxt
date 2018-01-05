<template>
  <div class="post">
    <component :is="component"/>
  </div>
</template>

<script>
// See https://vuejs.org/v2/guide/components.html#Advanced-Async-Components
const getPost = (slug) => ({
  component: import(`@/posts/${slug}`),
  error: require('@/posts/404')
})

export default {
  beforeCreate() {
    this.component = () => getPost(this.$route.params.slug)
  }
}
</script>

<style src="@/assets/css/post.css"/>
