<template>
  <div>
    <h3>I am the blue page</h3>
    <p>I am a child of /parent, and the theme is overwritten by myself!</p>
    <p>Go back to
      <nuxt-link to="/parent">Parent</nuxt-link>
    </p>
  </div>
</template>

<script>
export default {
  meta: {
    theme: 'blue'
  }
}
</script>
