<template>
  <BaseButton class="fancy-button">
    <slot />
  </BaseButton>
</template>

<style scoped>
button {
  appearance: none;
  background-color: #FAFBFC;
  border: 1px solid rgba(27, 31, 35, 0.15);
  border-radius: 6px;
  box-shadow: rgba(27, 31, 35, 0.04) 0 1px 0, rgba(255, 255, 255, 0.25) 0 1px 0 inset;
  color: #24292E;
}
</style>
