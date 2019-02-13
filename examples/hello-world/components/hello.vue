<template>
  <div>
    <pre>dataFn {{ dataFn }}</pre>
    <pre>hello {{ hello }}</pre>
    <pre>foo {{ foo }}</pre>
  </div>
</template>

<script>
export default {
  props: ['foo'],
  data() {
    return {
      dataFn: 'done'
    }
  },
  fetch() {
    console.log('fetch')
  },
  async asyncData() {
    console.log('async Data hello')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      hello: 'pouet',
      dataFn: this.dataFn,
      foo: this.foo
    }
  }
}
</script>
