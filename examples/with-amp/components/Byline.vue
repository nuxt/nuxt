<template>
  <div class="byline">
    By {{ author }}
  </div>
</template>

<script>
export default {
  author: {
    type: String,
    default: ''
  }
}
</script>
