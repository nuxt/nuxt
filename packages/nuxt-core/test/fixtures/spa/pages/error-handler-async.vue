<script>

export default {
  async asyncData() {
    await Promise.resolve()
    throw Error('asyncData error!')
  }
}
</script>
