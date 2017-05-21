<template>
  <div>
    <h1>{{ baz }}</h1>
    <br>
    <p>{{ $store.state.counter }}</p>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  computed: mapGetters('foo/bar', ['baz'])
}
</script>
