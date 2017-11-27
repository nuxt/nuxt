<template>
<foobar>
    {{id}}
</foobar>
</template>

<script>
import { nextId } from '@/lib/db'

export default {
  data() {
    return {
      id: nextId()
    }
  }
}
</script>