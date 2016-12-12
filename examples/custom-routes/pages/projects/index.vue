<template>
  <div class="container">
    <h1>Dynamic route example</h1>
    <h2>Projects list</h2>
    <p>
      <router-link :to="{ name: 'projects-slug', params: { slug: 'nuxtjs'} }">
        Nuxt.js
      </router-link>
    </p>
  </div>
</template>

<style scoped>
p
{
  text-align: center;
}
</style>
