<script>

export default {
  async asyncData () {
    await Promise.resolve()
    throw new Error('asyncData error!')
  }
}
</script>
