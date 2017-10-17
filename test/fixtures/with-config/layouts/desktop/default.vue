<template>
  <div>
    <h1>Default desktop layout</h1>
    <nuxt/>
  </div>
</template>

<style>
@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: 400;
  src: local('Roboto'), local('Roboto-Regular'), url(~/assets/roboto.woff2) format('woff2');
  unicode-range: U+0460-052F, U+20B4, U+2DE0-2DFF, U+A640-A69F;
}

body {
  font-family: 'Roboto';
}
</style>
