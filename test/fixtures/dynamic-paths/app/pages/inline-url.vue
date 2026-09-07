<template>
  <div>inline assets</div>
</template>

<style>
.inline-public-asset {
  background-image: url('/public.svg');
}
.inline-build-asset {
  background-image: url('~/assets/logo.svg');
}
@font-face {
  font-family: 'InlineFont';
  src: url('/css-only-public-asset.svg') format('woff2');
}
</style>
