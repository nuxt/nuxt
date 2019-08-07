<template>
  <h1>
    Hello from {{ name }}
  </h1>
</template>

<script>
export default {
  asyncData () {
    return {
      name: process.static ? 'static' : (process.server ? 'server' : 'client')
    }
  }
}
</script>
