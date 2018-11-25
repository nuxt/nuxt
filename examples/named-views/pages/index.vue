<template lang="html">
  <div class="main">
    <h1>Hello there</h1>
    <p>This is an example of a named views</p>
    <ul>
      <li>
        <nuxt-link to="/">
          Main
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
    </ul>

    <hr>
    <div>
      <div class="left">
        <router-view name="left" />
      </div>
      <div class="content">
        <nuxt-child />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Stage'
}
</script>

<style scoped>
  .main {
    margin: auto;
    max-width: 420px;
    padding: 10px;
  }

  .left {
    max-width: 150px;
    display: inline-block;
    vertical-align: top;
    border: 1px;
  }

  .left:empty {
    display: none;
  }

  .content {
    display: inline-block;
  }

</style>
