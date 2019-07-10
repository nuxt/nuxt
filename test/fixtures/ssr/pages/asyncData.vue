<template>
  <Foobar>{{ id }}</Foobar>
</template>

<script>
import { nextId } from '@/lib/db'

export default {
  asyncData () {
    return {
      id: nextId()
    }
  }
}
</script>
