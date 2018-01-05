<template>
  <h1>Error page</h1>
</template>

<script>
export default {
  asyncData({ req }) {
    throw new Error('Error mouahahah')
  }
}
</script>
