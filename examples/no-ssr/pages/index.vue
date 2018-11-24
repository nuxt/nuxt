<template>
  <div class="page">
    <h1>Home</h1>
    <NoSsr placeholder="Loading...">
      <h2>This part is rendered on the client-side only</h2>
    </NoSsr>
    <NoSsr>
      <p><code>placeholder</code> prop is optional</p>
    </NoSsr>
  </div>
</template>

<style scoped>
.no-ssr-placeholder {
  color: #41b883;
}
</style>
