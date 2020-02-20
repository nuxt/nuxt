<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <pre id="data" v-html="JSON.stringify($data)" />
</template>

<script>
export default {
  async fetch () {
    await new Promise(resolve => setTimeout(resolve, 100))
    this.user.inventory.items.push('B')
    this.user.name = 'Potato'
    this.foo = 'barbar'
    this.async2 = 'data2fetch'
  },
  async asyncData () {
    await new Promise(resolve => setTimeout(resolve, 100))
    return {
      async: 'data',
      async2: 'data2'
    }
  },
  data () {
    return {
      foo: 'bar',
      user: {
        name: 'Baz',
        inventory: {
          type: 'green',
          items: ['A']
        }
      }
    }
  }
}
</script>
