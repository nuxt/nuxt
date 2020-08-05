<template>
  <div>
    <h1>{{ $route.params.slug || 'Home' }}</h1>
    <pre>{{ userAgent }}</pre>
    <ul>
      <li>
        <NuxtLink to="/">
          Home
        </NuxtLink>
      </li>
      <li v-for="(slug, index) in slugs" :key="index">
        <NuxtLink :to="{ name: 'slug', params: { slug } }">
          {{ slug }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  asyncData ({ store, route, userAgent }) {
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
