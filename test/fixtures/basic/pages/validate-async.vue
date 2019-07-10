<template>
  <h1>I am valid</h1>
</template>

<script>
export default {
  validate ({ query }) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (query.error) {
          const err = new Error('Custom Error')
          err.statusCode = parseInt(query.error) || 500
          reject(err)
        } else {
          resolve(Boolean(query.valid))
        }
      }, 500)
    })
  }
}
</script>
