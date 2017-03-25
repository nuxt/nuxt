<template>
  <h1>{{ baz }}</h1>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  computed: mapGetters('foo/bar', ['baz'])
}
</script>
