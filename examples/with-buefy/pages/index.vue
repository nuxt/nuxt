<template>
  <nav class="navbar has-shadow is-light">
    <div class="container">
      <div class="navbar-brand">
        <nuxt-link to="/" class="navbar-item">
          <img src="~/assets/logo.png">
        </nuxt-link>
      </div>
      <div class="navbar-menu">
        <div class="navbar-start">
          <nuxt-link to="/" class="navbar-item is-tab" exact>Home</nuxt-link>
          <nuxt-link to="/about" class="navbar-item is-tab" exact>About</nuxt-link>
        </div>
      </div>
    </div>
  </nav>
</template>

<style lang="scss">
  $primary: blue;
  $navbar-tab-active-border-bottom-color: red;
  @import "~bulma";
  @import "~buefy/src/scss/buefy";
</style>
