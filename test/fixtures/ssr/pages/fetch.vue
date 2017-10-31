<template>
<foobar>{{$store.__id}}</foobar>
</template>

<script>
import { nextId } from '@/lib/db'

export default {
  async fetch({store}) {
    // We use store just as a shared reference
    store.__id = nextId()
  }
}
</script>
