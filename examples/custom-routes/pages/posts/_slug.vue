<template>
  <div class="container">
    <h2>Post : {{ $route.params.slug }}</h2>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
    </p>
    <p>
      <nuxt-link :to="{ name: 'posts-slug-name', params: { name: 'foo'} }">Foo</nuxt-link>
      <nuxt-link :to="{ name: 'posts-slug-name', params: { name: 'bar'} }">Bar</nuxt-link>
      <nuxt-link :to="{ name: 'posts-slug-comments' }">Comments</nuxt-link>
    </p>
    <nuxt-child :key="$route.params.name"></nuxt-child>
  </div>
</template>

<style scoped>
p
{
  text-align: center;
  padding: 15px 30px;
}
a
{
  margin: 0 15px;
}
</style>
