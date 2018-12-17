<template>
  <div>
    {{ initialized }}
  </div>
</template>

<script>
import { mapState } from 'vuex'

export default {
  computed: mapState({
    initialized: (state) => state.initialized
  })
}
</script>
