<template>
  <h1>I am valid</h1>
</template>

<script>
export default {
  validate({ query }) {
    return Boolean(query.valid)
  }
}
</script>
