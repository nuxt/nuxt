<template>
  <div>
    <div v-if="$nuxt.isOffline" class="offline">
      You are offline
    </div>
    <div class="container">
      <h1>{{ $route.name }}</h1>
      <Nuxt />
    </div>
  </div>
</template>

<style>
body {
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}
.container {
  padding: 10px 20px;
  padding-bottom: 40px;
}
.offline {
  background: #3B8070;
  color: white;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
}
a {
  display: block;
  padding: 10px 10px 10px 0px;
  margin: 20px 0;
  font-size: 20px;
  border-bottom: 2px #ddd solid;
  color: #3B8070;
  text-decoration: none;
  transition: border-bottom-color 0.3s linear;
}
a:hover,
a.nuxt-link-exact-active {
  background-color: rgb(245, 245, 245);
}
a.nuxt-link-prefetched:after {
  content: '';
  display: inline-block;
  background: url('../assets/check.svg') no-repeat;
  background-size: 14px;
  width: 14px;
  height: 14px;
  position: relative;
  right: -3px;
  top: 1px;
}
</style>
