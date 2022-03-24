<script setup>
definePageMeta({
  middleware: 'foo'
})

const foo = useExtendsFoo()
</script>

<template>
  <div>
    <div>Extended page from foo</div>
    <div>Middleware | foo: {{ $route.meta.foo }}</div>
    <div>Composable | useExtendsFoo: {{ foo }}</div>
    <div>Plugin | foo: {{ $foo() }}</div>
    <ExtendsFoo />
  </div>
</template>
