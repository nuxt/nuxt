<template>
  <nav class="navbar has-shadow is-light">
    <div class="container">
      <div class="navbar-brand">
        <NuxtLink to="/" class="navbar-item">
          <img src="~/assets/logo.png">
        </NuxtLink>
      </div>
      <div class="navbar-menu">
        <div class="navbar-start">
          <NuxtLink to="/" class="navbar-item is-tab" exact>
            Home
          </NuxtLink>
          <NuxtLink to="/about" class="navbar-item is-tab" exact>
            About
          </NuxtLink>
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
