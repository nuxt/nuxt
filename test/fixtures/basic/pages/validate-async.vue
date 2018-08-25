<template>
  <h1>I am valid</h1>
</template>

<script>
export default {
  validate({ query }) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(query.valid)
      }, 2000)
    })
  }
}
</script>
