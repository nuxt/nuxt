<template>
  <div>
    <NuxtLink to="/scroll-to-top/watch-query-true?test=1">
      go to the same page
    </NuxtLink>
  </div>
</template>

<script>
export default {
  watchQuery: true
}
</script>

<style>
div {
  margin-top: 1500px;
}
</style>
