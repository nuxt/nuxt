<template>
  <Foobar>{{ $store.__id }}</Foobar>
</template>

<script>
import { nextId } from '@/lib/db'

export default {
  fetch ({ store }) {
    // We use store just as a shared reference
    store.__id = nextId()
  }
}
</script>
