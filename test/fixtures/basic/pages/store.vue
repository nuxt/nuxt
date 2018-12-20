<template>
  <div>
    <h1>foo/bar/baz: {{ baz }}</h1>
    <br>
    <h2>index/counter: {{ $store.state.counter }}</h2>
    <br>
    <h3>foo/blarg/getVal: {{ getVal }}</h3>
    <br>
    <h4>foo/bab/getBabVal: {{ getBabVal }}</h4>
    <br>
    <button @click="$store.commit('increment')">
      +1
    </button>
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
