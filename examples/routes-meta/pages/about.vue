<template>
  <div>
    <h1>About</h1>
    <p> I am the about page and have set in my component:</p>
    <pre>export default {
  meta: {
    theme: 'dark'
  }
}</pre>
  </div>
</template>

<script>
export default {
  meta: {
    theme: 'dark'
  }
}
</script>

<style scoped>
pre {
  padding: 0.2rem 0.5rem;
  margin: 0 0.2rem;
  font-size: 90%;
  background: #f1f1f1;
  color: #202020;
  border: 1px solid #e1e1e1;
  border-radius: 4px;
  font-family: Consolas, Monaco, Menlo, monospace;
}
</style>
