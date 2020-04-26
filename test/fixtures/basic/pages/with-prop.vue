<template>
  <h1>Foo: {{ foo }}</h1>
</template>

<script>
  export default {
    layout: 'with-page-prop',
    props: ['foo']
  }
</script>
