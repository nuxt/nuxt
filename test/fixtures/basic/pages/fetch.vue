<template>
  <div>
    {{ data }}
    <button @click="update">
      Fetch
    </button>
    <button @click="reload">
      Reload
    </button>
  </div>
</template>

<script>
const name = process.server ? 'server' : 'client'
const baseURL = 'http://localhost:3000/api'
const getData = () => fetch(`${baseURL}/test`)
  .then(r => r.text())
  .then(r => r + ` (From ${name})`)

export default {
  async asyncData () {
    const data = await getData()
    return { data }
  },
  methods: {
    async update () {
      this.data = await getData()
    },
    reload () {
      window.location.reload()
    }
  }
}
</script>
