<template>
  <div>
    <h1>I can haz meta tags</h1>
  </div>
</template>

<script>
export default {
  head: {
    title: 'My title',
    htmlAttrs: {
      foo: 'baz'
    },
    headAttrs: {
      bar: 'foo'
    },
    bodyAttrs: {
      baz: 'bar'
    },
    meta: [
      { content: 'my meta' }
    ],
    script: [
      { src: '/body.js', body: true }
    ]
  }
}
</script>
