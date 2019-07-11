<template>
  <button @click="handleClick">
    {{ label }}
  </button>
</template>

<script>
export default {
  name: 'Button',
  props: {
    label: {
      type: String,
      required: true
    }
  },
  data: () => ({
    clicked: false
  }),
  methods: {
    handleClick () {
      this.clicked = true
    }
  }
}
</script>
