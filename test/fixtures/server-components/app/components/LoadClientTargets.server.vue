<!-- `v-load-client` rather than `nuxt-client`, so legacy builds never treat these as selective-client targets -->
<template>
  <div>
    <PairedLoadClient v-load-client>
      <span id="paired-slot">PAIRED_SLOT</span>
    </PairedLoadClient>
    <SoloLoadClient v-load-client />
    <ToggleSlot
      id="toggle-slot"
      v-load-client
    >
      <span class="toggle-slot-content">TOGGLE_SLOT</span>
      <Counter
        v-load-client
        :multiplier="2"
      />
    </ToggleSlot>
  </div>
</template>
