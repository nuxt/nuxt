<template>
  <div>
    <strong>Custom layout</strong>
    Header slot:
    <slot name="header">
      Default slot content
    </slot>
    <slot />
  </div>
</template>

<script>
export default {
  created () {
    console.log('layout created')
  }
}
</script>
