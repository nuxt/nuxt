<template>
  <h1>I am valid</h1>
</template>

<script>
export default {
  validate({ query }) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Boolean(query.valid))
      }, 500)
    })
  }
}
</script>
