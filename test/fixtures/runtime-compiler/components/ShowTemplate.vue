<template>
  <component
    :is="showIt"
    :name="name"
  />
</template>

<script>
export default defineNuxtComponent({
  props: {
    template: {
      required: true,
      type: String
    },
    name: {
      type: String,
      default: () => '(missing name prop)'
    }
  },
  setup (props) {
    const showIt = h({
      template: props.template,
      props: {

        name: {
          type: String,
          default: () => '(missing name prop)'
        }
      }
    })

    return {
      showIt
    }
  }
})
</script>
