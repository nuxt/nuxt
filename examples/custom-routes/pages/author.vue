<template>
  <div class="container">
    <h1>Basic route with Alias</h1>
    <router-link to="/nuxt" class="Navbar__Links__Item__Link" v-if="$route.path === '/author'">
      This route is also available on /nuxt
    </router-link>
    <router-link to="/author" class="Navbar__Links__Item__Link" v-else>
      This route is also available on /author
    </router-link>
  </div>
</template>

<style scoped>
.container
{
  text-align: center;
  padding-bottom: 30px;
}
</style>
