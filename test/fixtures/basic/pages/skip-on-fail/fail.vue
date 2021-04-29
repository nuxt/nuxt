<template>
  <h1>404</h1>
</template>

<script>
export default {
  asyncData ({ error }) {
    error({ statusCode: 404, message: 'Post not found' })
  }
}
</script>
