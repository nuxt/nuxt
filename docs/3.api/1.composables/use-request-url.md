# useRequestURL

`useRequestURL` is a helper function that returns an [URL object](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) working on both server-side and client-side.

::code-group

```vue [pages/about.vue]
<script setup>
const url = useRequestURL()
</script>

<template>
  <p>URL is: {{ url }}</p>
  <p>Path is: {{ url.pathname }}</p>
</template>
```

```html [Result in development]
<p>URL is: http://localhost:3000/about</p>
<p>Path is: /about</p>
```

::

You can find the list of the [URL instance properties](https://developer.mozilla.org/en-US/docs/Web/API/URL#instance_properties) on the MDN documentation.
