<script>

export default {
  middleware (context) {
    throw { error: 'fetch error!' } // eslint-disable-line
  }
}
</script>
