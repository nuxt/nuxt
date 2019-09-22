<template>
  <div>
    <NuxtLink to="/scroll-to-top/watch-query-fn?test=1">
      go to the same page with other test
    </NuxtLink>
    <NuxtLink to="/scroll-to-top/watch-query-fn?other=1">
      go to the same page with param other
    </NuxtLink>
  </div>
</template>

<script>
export default {
  watchQuery (newQuery, oldQuery) {
    return newQuery.test
  }
}
</script>

<style>
div {
  margin-top: 1500px;
}
</style>
