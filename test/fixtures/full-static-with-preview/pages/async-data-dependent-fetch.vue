<template>
  <div>
    <p>{{ text }}</p>
    <ComponentRenderer
      v-for="component in components"
      :key="component.id"
      :component="component"
    />
  </div>
</template>

<script>
const fetchData = () => {
  return new Promise((resolve) => {
    setTimeout(() => resolve([
      {
        id: 1,
        name: 'ComponentWithFetch',
        props: { name: 'component-1' },
        components: [
          {
            id: 2,
            name: 'ComponentWithFetch',
            props: { name: 'component-2' },
            components: []
          },
          {
            id: 3,
            name: 'ComponentWithFetch',
            props: { name: 'component-3' },
            components: []
          }
        ]
      }
    ]), 10)
  })
}

export default {
  name: 'Page',
  async asyncData () {
    const components = await fetchData()

    return { components }
  },
  data () {
    return {
      text: ''
    }
  },
  fetch () {
    this.text = 'page-fetch-called'

    if (this.$preview) {
      this.text = 'page-fetch-called-in-preview'
    }
  }
}
</script>
