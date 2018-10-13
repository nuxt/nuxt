<template>
  <button @click="handleClick">
    {{ label }}
  </button>
</template>

<script>
export default {
  name: 'Button',
  data: () => ({
    clicked: false,
  }),
  props: {
    label: {
      type: String,
      required: true
    }
  },
  methods: {
    handleClick () {
      this.clicked = true;
    },
  },
};
</script>
