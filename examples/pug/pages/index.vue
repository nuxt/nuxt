<template lang="pug">
  div
    h1 Welcome
    NuxtLink(to="/about") About Page
</template>

<script>
export default {
  head: {
    title: 'Home page'
  }
}
</script>
