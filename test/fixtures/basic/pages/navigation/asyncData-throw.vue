<template>
  <h1>Async Throw Error</h1>
</template>
<script>
export default {
  async asyncData () {
    await new Promise(resolve => setTimeout(resolve, 2000))
    throw new Error('crash')
  }
}
</script>
