<template>
  <div>
    My Component
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'

export default defineComponent({
  props: {
    stringItems: {
      type: Array as PropType<string[]>,
      required: true,
    }
  }
})
</script>
