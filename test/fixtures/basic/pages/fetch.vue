<template>
  <div>
    {{ data }}
    <button @click="update">
      Fetch
    </button>
    <button @click="reload">
      Reload
    </button>
    <code>{{ fetched }}</code>
  </div>
</template>

<script>
const name = process.server ? 'server' : 'client'
const baseURL = 'http://localhost:3000/api'
const getData = () => fetch(`${baseURL}/test`)
  .then(r => r.text())
  .then(r => r + ` (From ${name})`)

export default {
  async asyncData ({ $config }) {
    if ($config.generated) { return }

    const data = await getData()
    return { data }
  },
  data: () => ({
    num: 10,
    fetched: false
  }),
  async fetch () {
    await new Promise((resolve) => {
      this.fetched = true
      resolve()
    })
  },
  fetchKey (getCounter) {
    return 'custom' + this.num + getCounter('custom')
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
