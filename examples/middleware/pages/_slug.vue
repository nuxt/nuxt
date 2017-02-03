<template>
  <div>
    <h1>{{ $route.params.slug || 'Home' }}</h1>
    <pre>{{ userAgent }}</pre>
    <ul>
      <li><nuxt-link to="/">Home</nuxt-link></li>
      <li v-for="slug in slugs"><nuxt-link :to="{ name: 'slug', params: { slug } }">{{ slug }}</nuxt-link></li>
    </ul>
  </div>
</template>

<script>
export default {
  data ({ store, route, userAgent }) {
    return {
      userAgent,
      slugs: [
        'foo',
        'bar',
        'baz'
      ]
    }
  }
}
</script>
