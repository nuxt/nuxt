<template>
  <h1
    id="product-page"
    class="client-only-style"
  >
    Product {{ $route.params.id }}
  </h1>
</template>

<style>
.client-only-style { color: red; }
</style>
