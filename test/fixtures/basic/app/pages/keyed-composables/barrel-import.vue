<script setup lang="ts">
// check that `useState` works when imported from barrel export `#app`
// - this is only for backwards compat
import { useState } from '#app'

const state = useState()
</script>

<template>
  <div />
</template>
