<template>
  <div>
    <h1>Cached components</h1>
    <p>Look at the source code and see how the timestamp is not reloaded before 10s after refreshing the page.</p>
    <p>Timestamp: {{ date }}</p>
  </div>
</template>

<script>
export default {
  name: 'date',
  serverCacheKey() {
    // Will change every 10 secondes
    return Math.floor(Date.now() / 10000)
  },
  data() {
    return { date: Date.now() }
  }
}
</script>
