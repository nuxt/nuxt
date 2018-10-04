<template>
  <div>
    <h1>{{ baz }}</h1>
    <br>
    <p>{{ $store.state.counter }}</p>
    <br>
    <h2>{{ getVal }}</h2>
    <br>
    <h3>{{ getBabVal }}</h3>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  computed: {
    ...mapGetters('foo/bar', ['baz']),
    ...mapGetters('foo/blarg', ['getVal']),
    ...mapGetters('bab', ['getBabVal'])
  }
}
</script>
