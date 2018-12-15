<template>
  <div class="main">
    <p>Page with SCSS</p>
    <p>
      <NuxtLink to="/less">
        LESS
      </NuxtLink>
    </p>
  </div>
</template>

<style lang="scss" scoped>
/* ~/assets/variables.scss is injected automatically here */
.main {
  background: $main;
  padding: 10px;
}
</style>
