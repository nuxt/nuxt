<template>
  <h1>Async Data Error</h1>
</template>
<script>
export default {
  middleware: ['slow'],
  asyncData ({ error, route }) {
    error({ statusCode: 401, message: 'Not allowed here' })
  }
}
</script>
