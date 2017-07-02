<template>
  <BlogArticle/>
</template>

<script>
export default {
  async asyncData({ params, error }) {
    const slug = params.slug || 'hello'
    try {
      this.components.BlogArticle = await import(`~/articles/${slug}.vue`)
    } catch (e) {
      error({ statusCode: 404, message: 'Article not found' })
    }
  }
}
</script>