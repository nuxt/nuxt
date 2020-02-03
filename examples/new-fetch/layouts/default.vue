<template>
  <div>
    <!-- <p>Fetching: {{ $nuxt.isFetching }} ({{ $nuxt.nbFetching }})</p> -->
    <nuxt />
  </div>
</template>

<script>
export default {
  head: {
    link: [
      { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/kognise/water.css@1.4.0/dist/light.min.css' }
    ]
  }
}
</script>

<style>
body {
  padding: 20px 30px;
}
.page-enter-active, .page-leave-active {
  transition: opacity .3s;
}
.page-enter, .page-leave-to {
  opacity: 0;
}
</style>
