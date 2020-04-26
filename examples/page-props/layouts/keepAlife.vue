<template>
  <div>
    <h1>KeepAlife Layout</h1>
    <Nuxt :foo="{ count: bar }" keep-alive :keep-alive-props="{keepalifeprop: 9}"/>
  </div>
</template>

<script>
  export default {
    data: () => ({ bar: 1 }),
    mounted () {
      setInterval(() => this.bar++, 1000);
    }
  }
</script>
