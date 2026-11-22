<script setup lang="ts">
const form = reactive({ name: 'Daniel', password: 'hunter2', role: 'member', plan: 'free', tier: 'basic', legacyTier: 'basic', trialTier: 'basic' })
const isAdmin = ref(false)
const saved = ref<string>()

/**
 * Save the account settings. Use when the user asks to update their profile.
 * @tool values
 */
function saveSettings () {
  saved.value = `${form.name}, ${form.role}, ${form.plan}, ${form.tier}, ${form.legacyTier}, ${form.trialTier}`
  return 'Saved.'
}
</script>

<template>
  <form @submit.prevent="saveSettings">
    <label>Name <input v-model="form.name"></label>
    <label>Password <input
      v-model="form.password"
      type="password"
    ></label>
    <label v-if="isAdmin">Role <input v-model="form.role"></label>
    <fieldset disabled>
      <label>Plan <input v-model="form.plan"></label>
    </fieldset>
    <TierPicker
      v-model="form.tier"
      aria-label="Tier"
    />
    <TierPicker
      v-model="form.legacyTier"
      aria-label="Legacy tier"
      aria-disabled="true"
    />
    <TierPicker
      v-model="form.trialTier"
      aria-label="Trial tier"
      :disabled="!isAdmin"
    />
    <button type="submit">
      Save
    </button>
    <p data-testid="saved">
      {{ saved }}
    </p>
  </form>
</template>
