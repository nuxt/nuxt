<template>
  <div class="server-slots">
    <SlotBox>
      <p class="box-content">
        island box content
      </p>
    </SlotBox>
    <slot>
      <p class="default-fallback">
        default fallback
      </p>
    </slot>
    <SlotEcho nuxt-client>
      <slot name="in-client" />
    </SlotEcho>
    <slot name="unused">
      <p class="unused-fallback">
        unused fallback
      </p>
    </slot>
  </div>
</template>
