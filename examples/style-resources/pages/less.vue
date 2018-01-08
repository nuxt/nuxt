<template>
  <div class="main">
    <p>Page with LESS</p>
    <p><nuxt-link to="/">SCSS</nuxt-link></p>
  </div>
</template>

<style lang="less" scoped>
/* ~/assets/*.less are injected automatically here */
.main {
  background: @main;
  padding: 10px;
}
a {
  color: white;
}
</style>
