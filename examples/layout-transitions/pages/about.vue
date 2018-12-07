<template>
  <div class="container">
    <h1>About page</h1>
    <NuxtLink to="/">
      Home page
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: 'secondary',
  transition: 'bounce',
  head: {
    title: 'About'
  }
}
</script>
