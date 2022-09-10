<template>
  <div>
    <img src="~/assets/logo.svg" class="h-20 mb-4">
    <img src="/public.svg" class="h-20 mb-4">
    <img :src="logo" class="h-20 mb-4">
  </div>
</template>

<script setup>
import logo from '~/assets/logo.svg'
</script>

<style>
#__nuxt {
  background-image: url('~/assets/logo.svg');
  background-repeat: no-repeat;
  background-position: bottom right;
  @font-face {
    src: url("/public.svg") format("woff2");
  }
}
body {
  background-image: url('/public.svg');
  background-repeat: no-repeat;
  background-position: top;
  @font-face {
    src: url('/public.svg') format('woff2');
  }
}
</style>
