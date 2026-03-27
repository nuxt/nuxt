<script setup lang="ts">
const post = ref({
  title: 'Getting Started with Nuxt',
  excerpt: 'Learn how to build modern web applications with Nuxt 3.',
  author: 'Jane Doe',
})
</script>

<template>
  <div>
    <NuxtLink to="/">← Back</NuxtLink>

    <Title>Blog - <span>{{ post.title }}</span></Title>

    <h1>{{ post.title }}</h1>
    <p>By {{ post.author }}</p>
    <p>{{ post.excerpt }}</p>

    <h2>Related Posts</h2>
    <NuxtLink to="/blog-post">
      <NuxtLink to="/blog-post">Why Nuxt is Great for SEO</NuxtLink>
      <p>Discover how Nuxt improves your search engine rankings.</p>
    </NuxtLink>

    <NuxtLink to="/blog-post" href="/blog-post">Read more articles</NuxtLink>
  </div>
</template>
