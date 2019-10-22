<template>
  <h1>I am valid</h1>
</template>

<script>
export default {
  validate ({ query }) {
    if (query.error) {
      const err = new Error('Custom Error')
      err.statusCode = parseInt(query.error) || 500
      throw err
    }

    return Boolean(query.valid)
  }
}
</script>
