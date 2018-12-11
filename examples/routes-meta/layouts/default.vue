<template>
  <div :class="$store.state.theme" class="theme">
    <div class="nav horizontal-align">
      <NuxtLink class="nav-item" to="/">
        Home
      </NuxtLink>
      <NuxtLink class="nav-item" to="/about">
        About
      </NuxtLink>
      <NuxtLink class="nav-item" to="/parent">
        Parent page
      </NuxtLink>
    </div>
    <Nuxt class="container" />
  </div>
</template>

<style>
body,
html {
  padding: 0;
  margin: 0;
  min-height: 100vh;
}
.nav-item {
  text-decoration: none;
  font-size: 1.2em;
}
.theme {
  min-height: 100vh;
  padding-top: 2rem;
}
/*
** Light theme
*/
.theme.light {
  background: #f5f5f5;
  color: #202020;
}
.theme.light a {
  color: #555;
}
/*
** Dark theme
*/
.theme.dark {
  background: #202020;
  color: #f5f5f5;
}
.theme.dark a {
  color: #eee;
}
/*
** Orange theme
*/
.theme.orange {
  background: #ffc107;
  color: #795548;
}
.theme.orange a {
  color: #202020;
}
/*
** Blue theme
*/
.theme.blue {
  background: #3f51b5;
  color: #f5f5f5;
}
.theme.blue a {
  color: #eee;
}
</style>
