<template>
  <div class="container">
    <h1>Dynamic route example</h1>
    <h2>Projects list</h2>
    <p>
      <nuxt-link :to="{ name: 'projects-slug', params: { slug: 'nuxtjs'} }">
        Nuxt.js
      </nuxt-link>
    </p>
  </div>
</template>

<style scoped>
p
{
  text-align: center;
}
</style>
