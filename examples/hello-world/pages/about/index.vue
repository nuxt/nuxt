<template>
  <div>
    I am /pages/about/index.vue {{ p }}
  </div>
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
