<template>
  <div class="byline">
    By {{ author }}
  </div>
</template>

<script>
export default {
  props: {
    author: {
      type: String,
      default: ''
    }
  }
}
</script>
