<template>
  <p>Error page because of asyncData rejection</p>
</template>

<script>
export default {
  asyncData() {
    return new Promise((resolve, reject) => {
      reject(new Error('Generic AsyncData Error'))
    })
  }
}
</script>
