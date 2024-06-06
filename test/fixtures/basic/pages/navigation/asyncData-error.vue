<template>
  <h1>Async Data Error</h1>
</template>
<script>
export default {
  async asyncData ({ error }) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    error({ statusCode: 401, message: 'Not allowed here' })
  }
}
</script>
