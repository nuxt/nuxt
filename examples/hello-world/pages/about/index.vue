<template>
  <p>
    I am /pages/about/index.vue {{ p }}
  </p>
</template>

<script>
export default {
  props: {
    project: {
      type: Object,
      required: true
    }
  },
  async asyncData(ctx) {
    await new Promise(resolve => setTimeout(resolve, 500))
    return {
      p: Object.assign({}, this.project, { extended: true })
    }
  }
}
</script>
