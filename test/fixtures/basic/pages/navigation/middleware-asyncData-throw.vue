<template>
  <h1>Async Throw Error</h1>
</template>
<script>
export default {
  middleware: ['slow'],
  asyncData () {
    throw new Error('crash')
  }
}
</script>
