<template>
  <div>
    <h2>Page 1</h2>

    <NuxtLink
      id="link"
      to="/page-2"
    >
      To page 2
    </NuxtLink>
  </div>
</template>

<script>
export default {
  layout: 'layout-1',

  mounted () {
    window.mountedCount = (window.mountedCount || 0) + 1
  }
}
</script>
