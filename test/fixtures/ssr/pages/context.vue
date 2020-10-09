<template>
  <div>
    <section data-test="parent">
      <pre>vm: {{ $route.fullPath }}</pre>
      <pre>context: {{ $nuxt.context.route.fullPath }}</pre>
    </section>

    <NuxtChild />
  </div>
</template>
