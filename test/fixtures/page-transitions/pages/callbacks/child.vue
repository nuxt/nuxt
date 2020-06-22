<template>
  <div>
    <h1>Callbacks child page</h1>
  </div>
</template>
<script>
import { createTransitionObject } from '../../utils/transition-properties'
export default {
  transition: createTransitionObject('callbacks-child', 'page', 'true')
}
</script>
