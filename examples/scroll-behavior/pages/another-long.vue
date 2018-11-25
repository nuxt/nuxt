<template>
  <div class="container">
    <h1>Another long page</h1>
    <div class="spacer" style="width: 100%; height: 3000px; background: darkgreen" />
    <NuxtLink to="/">
      Home page
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: 'default2',
  scrollToTop: true
}
</script>
