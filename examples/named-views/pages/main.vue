<template lang="html">
  <div class="main">
    <h1>Main page</h1>
    <p>This is an example of a named views</p>
    <ul>
      <li>
        <nuxt-link to="/">
          Root
        </nuxt-link>
      </li>
      <li>
        <nuxt-link to="/section">
          Section
        </nuxt-link>
      </li>
      <li>
        <nuxt-link to="/child/123">
          Child 123
        </nuxt-link>
      </li>
      <li>
        <nuxt-link to="/child/234">
          Child 234
        </nuxt-link>
      </li>
      <li>
        <nuxt-link to="/main">
          Main page with named view in layout
        </nuxt-link>
      </li>
    </ul>

    <hr>
    <p>At top of this page there is named view from layout!</p>
  </div>
</template>

<script>
export default {
  name: 'Main'
}
</script>

<style scoped>
  .main {
    margin: auto;
    max-width: 420px;
    padding: 10px;
  }
</style>
