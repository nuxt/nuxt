<template>
  <div class="wrapper">
    <div class="header">
      <NuxtLink to="/">
        NUXT BLOG
      </NuxtLink>
    </div>
    <p class="links">
      <a href="https://twitter.com/nuxt_js" target="_blank">
        <img src="~/assets/img/twitter.png">
      </a>
      <a href="https://github.com/nuxt/nuxt.js/tree/dev/examples/async-component-injection" target="_blank">
        <img src="~/assets/img/github.png">
      </a>
    </p>
    <div class="main">
      <Nuxt />
    </div>
  </div>
</template>
