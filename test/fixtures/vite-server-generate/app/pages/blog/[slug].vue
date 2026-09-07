<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <p id="blog-post">
    blog post {{ route.params.slug }}
  </p>
</template>
