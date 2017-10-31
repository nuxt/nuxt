<template>
<foobar>{{id}}</foobar>
</template>

<script>
import { nextId } from '@/lib/db'

export default {
  async asyncData() {
    return {
      id: nextId()
    }
  }
}
</script>
