<template>
  <div>
    <h1>Callbacks page</h1>
    <NuxtChild />
  </div>
</template>
<script>
import { createTransitionObject } from '../utils/transition-properties'
export default {
  transition: createTransitionObject('callbacks')
}
</script>
