<template>
  <div>
    <h1>Default Layout</h1>
    <Nuxt :foo="{ count: bar }" />
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
