<template>
  <div>
    <NuxtLink to="/scroll-to-top/scroll-to-top-true">
      go to scroll-to-top-true
    </NuxtLink>
    <NuxtLink to="/scroll-to-top/scroll-to-top-false">
      go to scroll-to-top-false
    </NuxtLink>
    <NuxtLink to="/scroll-to-top?test=1">
      go to the same page
    </NuxtLink>
  </div>
</template>

<script>
export default {
}
</script>

<style>
div {
  margin-top: 1500px;
}
</style>
