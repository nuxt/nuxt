<template>
  <div>
    <p>{{ text }}</p>
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    name: {
      type: String,
      default: 'component'
    }
  },
  data () {
    return {
      text: ''
    }
  },
  fetch () {
    this.text = `${this.name}-fetch-called`

    if (this.$preview) {
      this.text = `${this.name}-fetch-called-in-preview`
    }
  }
}
</script>
