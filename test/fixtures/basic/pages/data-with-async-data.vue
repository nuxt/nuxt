<template>
  <div>
    <p>{{ name }}</p>
    <p>{{ otherKey }}</p>
  </div>
</template>

<script>
const fetchData = () => {
  return new Promise(resolve => {
    setTimeout(() => resolve({ name: 'Async Name' }), 10)
  })
}

export default {
  data () {
    return {
      name: 'Synchronous Name Overwritten By asyncData response',
      otherKey: 'Synchronous otherKey still here'
    }
  },
  async asyncData () {
    return await fetchData()
  }
}
</script>
