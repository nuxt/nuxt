<template>
  <div>
    <h1>I'm RED</h1>
    <section class="container">
      <div class="item-a">
        item-a
      </div>
      <div class="item-b">
        item-b
      </div>
      <div class="item-c">
        item-c
      </div>
      <div class="item-d">
        item-d
      </div>
      <div class="item-e">
        item-e
      </div>
    </section>
  </div>
</template>

<style scoped>
  /* INDEX CSS */
  h1 {
    color: red;
  }
  .container {
    display: grid;
    grid-template-columns: 60px 60px 60px 60px 60px;
    grid-template-rows: 30px 30px;
    grid-auto-flow: row;
  }
  /* END OF INDEX CSS */
</style>
