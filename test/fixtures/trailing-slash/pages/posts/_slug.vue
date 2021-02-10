<template>
  <div>
    [pages/posts/_slug]
  </div>
</template>

<script>
export default {
  data: () => ({
    result: null
  }),
  fetch () {
    this.result = process.server ? 'fetched' : null
  }
}
</script>
