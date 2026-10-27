<template>
  <div id="hydration-page">
    <div class="page-counter">
      <Counter :multiplier="3" />
    </div>
    <MultiServerCounter
      block-id="hydration-island"
      :multiplier="4"
    />
  </div>
</template>
