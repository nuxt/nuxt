<template>
  <div>Hello SPA!</div>
</template>

<script>
export default {
  layout: 'custom',
  mounted() {
    window.customMounted = (+window.customMounted) + 1
    console.log('mounted') // eslint-disable-line no-console
  }
}
</script>
