<template lang="html">
  <div class="main">
    <h1>Main page</h1>
    <p>This is an example of a named views</p>
    <ul>
      <li>
        <NuxtLink to="/">
          Root
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/section">
          Section
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/child/123">
          Child 123
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/child/234">
          Child 234
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/main">
          Main page with named view in layout
        </NuxtLink>
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
