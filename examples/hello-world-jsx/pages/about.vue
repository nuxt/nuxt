<script>
export default {
  asyncData({ req }) {
    return {
      name: req ? 'server' : 'client'
    }
  },
  render(h) {
    return <div>
      <p>Hi from {this.name}</p>
      <nuxt-link to="/">Home page</nuxt-link>
    </div>
  }
}
</script>
