<template>
  <button @click="handleClick">
    {{ label }}
  </button>
</template>

<script>
export default {
  // eslint-disable-next-line vue/no-reserved-component-names
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
