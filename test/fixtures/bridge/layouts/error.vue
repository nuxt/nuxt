<template>
  <div>
    {{ error.message || 'An error occurred' }}
  </div>
</template>

<script>
export default {
  props: ['error']
}
</script>
