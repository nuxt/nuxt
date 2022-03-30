<template>
  <div>
    <strong>Custom layout</strong>
    Header slot:
    <slot name="header">
      Default slot content for <code>Custom</code> layout
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
