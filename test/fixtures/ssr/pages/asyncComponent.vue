<template>
<div>
    <async-test/>
</div>
</template>

<script>

export default {
  async asyncData({ error }) {
    try {
      this.components.AsyncTest = await import(`@/components/test.vue`)
    } catch (e) {
      error({ statusCode: 404, message: 'Can not load test component' })
    }
  }
}
</script>