<template>
  <h1>Error page</h1>
</template>

<script>
export default {
  data () {
    throw new Error('Error mouahahah')
  }
}
</script>
