<template>
  <div>
    <h1>About page</h1>
    <h2>{{ meta[0].text }}</h2>
    <NuxtLink to="/">
      Home page
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: 'custom',
  asyncData ({ route }) {
    return { meta: route.meta || 'empty-meta' }
  }
}
</script>
