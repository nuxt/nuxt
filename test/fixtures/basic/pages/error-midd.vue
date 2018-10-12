<template>
  <h1>Error page midd</h1>
</template>

<script>
export default {
  middleware: 'error',
  asyncData() {
    console.log('Async data error-midd.vue') // eslint-disable-line no-console
    return {}
  }
}
</script>
