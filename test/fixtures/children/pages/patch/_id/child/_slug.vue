<template>
  <div>
    <h4>
      _slug: <i data-date-child-slug>
        {{ date }}
      </i>
    </h4>
    <input ref="search" v-model="q" data-test-search-input type="text" @input="update">
    <ul>
      <li v-for="s in searchResults" :key="s" data-test-search-result>
        {{ s }}
      </li>
    </ul>
  </div>
</template>

<script>
const countries = [
  'Bhutan',
  'United Kingdom',
  'Guinea',
  'Czech Republic',
  'Netherlands'
]
function search (q) {
  q = String(q || '').toLowerCase()

  return new Promise((resolve) => {
    const searchResults = countries.filter(s => s.toLowerCase().includes(q))
    setTimeout(() => resolve(searchResults), 100)
  })
}

export default {
  async asyncData ({ query }) {
    const searchResults = await search(query.q)
    return {
      searchResults,
      date: Date.now()
    }
  },
  data () {
    return {
      q: this.$route.query.q || ''
    }
  },
  watch: {
    async '$route.query.q' (q) {
      this.searchResults = await search(q)
    }
  },
  mounted () {
    this.$refs.search.selectionStart = this.$refs.search.selectionEnd = this.$refs.search.value.length
    this.$refs.search.focus()
  },
  methods: {
    update () {
      this.$router.replace({ query: Object.assign({}, this.$route.query, { q: this.q }) })
    }
  }
}
</script>
