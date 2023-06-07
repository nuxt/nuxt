<template>
  <div>
    <p>{{ text }}</p>
    <ComponentWithFetch>
      <ComponentWithFetch name="sub-component" />
    </ComponentWithFetch>
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
