<template>
  <component :is="component.name" v-bind="component.props">
    <template v-if="component.components">
      <ComponentRenderer
        v-for="nestedComponent in component.components"
        :key="nestedComponent.id"
        :component="nestedComponent"
      />
    </template>
  </component>
</template>

<script>

export default {
  name: 'ComponentRenderer',
  props: {
    component: {
      type: Object,
      required: true
    }
  }
}
</script>
