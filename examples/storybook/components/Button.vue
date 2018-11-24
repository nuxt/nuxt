<template>
  <button :style="{color: color, borderColor: color}" :class="{rounded: rounded}" class="wr-button" @click="handleClick">
    <slot />!
  </button>
</template>

<script>
export default {
  props: {
    rounded: {
      type: Boolean,
      default: false
    },
    handleClick: {
      type: Function,
      default: () => () => null
    },
    color: {
      type: String,
      default: '#42b983'
    }
  }
}
</script>

<style>
.rounded {
  border-radius: 10px;
}
.wr-button {
  border: 3px solid;
  padding: 10px 20px;
  background-color: white;
  outline: none;
}
</style>
