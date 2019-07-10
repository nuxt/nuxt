<template>
  <h1>Error page</h1>
</template>

<script>
export default {
  asyncData () {
    throw new Error('Error mouahahah')
  }
}
</script>
