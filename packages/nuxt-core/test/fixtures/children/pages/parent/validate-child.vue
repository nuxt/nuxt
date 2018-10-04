<template>
  <h2>Child valid</h2>
</template>

<script>
export default {
  validate({ query }) {
    return query.key === '12345'
  }
}
</script>
