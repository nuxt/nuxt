<template>
  <section data-test="child">
    <pre>vm: {{ $route.fullPath }}</pre>
    <pre>context: {{ $nuxt.context.route.fullPath }}</pre>
  </section>
</template>
