<template>
  <div>
    <h1>Page with meta</h1>
    <p>
      This example is made to illustrate the usafe of
      <code>meta</code> inside the page components.
    </p>
    <p>
      We have a middleware setup in
      <code>~/middleware/theme.js</code> used to get which theme has to be applied and commit it to the store.
    </p>
    <p>
      Then, in our layout, we simply use
      <code>$store.state.theme</code> as a class to change our CSS dynamically.
    </p>
  </div>
</template>

<script>
export default {
}
</script>
