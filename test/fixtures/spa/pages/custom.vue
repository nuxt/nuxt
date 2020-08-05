<template>
  <div>Hello SPA!</div>
</template>

<script>
export default {
  layout: 'custom',
  created () {
    console.log('created') // eslint-disable-line no-console
  },
  mounted () {
    console.log('mounted') // eslint-disable-line no-console
  }
}
</script>
