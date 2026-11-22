<!-- `v-load-client` rather than `nuxt-client`, so legacy builds never treat these as selective-client targets -->
<template>
  <div>
    <PairedLoadClient v-load-client.slots>
      <span id="paired-slot">PAIRED_SLOT</span>
    </PairedLoadClient>
    <SoloLoadClient v-load-client />
    <ToggleSlot
      id="toggle-slot"
      v-load-client.slots
    >
      <span class="toggle-slot-content">TOGGLE_SLOT</span>
      <Counter
        v-load-client
        :multiplier="2"
      />
    </ToggleSlot>
    <ToggleSlot
      id="toggle-slot-unsent"
      v-load-client
    >
      <span class="toggle-slot-content">UNSENT_SLOT_CONTENT</span>
    </ToggleSlot>
  </div>
</template>
