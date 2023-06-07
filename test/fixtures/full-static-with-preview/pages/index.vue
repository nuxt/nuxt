<template>
  <div>
    <p>{{ text }}</p>
  </div>
</template>

<script>
export default {
  data () {
    return {
      text: ''
    }
  },
  fetch () {
    this.text = 'page-fetch-called'

    if (this.$preview) {
      this.text = 'page-fetch-called-in-preview'
    }
  }
}
</script>
