<template>
  <div class="page">
    <h1>Home</h1>
    <no-ssr placeholder="Loading...">
      <h2>This part is rendered on the client-side only</h2>
    </no-ssr>
    <no-ssr>
      <p><code>placeholder</code> prop is optional</p>
    </no-ssr>
  </div>
</template>

<style scoped>
.no-ssr-placeholder {
  color: #41b883;
}
</style>
