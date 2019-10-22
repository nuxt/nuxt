<template>
  <Foobar>{{ id }}</Foobar>
</template>

<script>
import { nextId } from '@/lib/db'

export default {
  data () {
    return {
      id: nextId()
    }
  }
}
</script>
