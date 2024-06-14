<template>
  <div>
    <h2>Error page {{ error.statusCode }}</h2>

    <NuxtLink
      id="link"
      to="/page-1"
    >
      To page 1
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: 'layout-error',
  props: ['error'],
  mounted () {
    window.mountedCount = (window.mountedCount || 0) + 1
  }
}
</script>
