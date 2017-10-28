<template>
  <div>Hello SPA!</div>
</template>

<script>
export default {
  mounted () {
    window.indexMounted = (+window.indexMounted) + 1
    console.log('mounted')
  }
}
</script>