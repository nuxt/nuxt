<script setup lang="ts">
import { z } from 'zod'

const contactSchema = z.object({
  email: z.email(),
  topic: z.enum(['order', 'other']),
  message: z.string().min(5),
})

const form = reactive({ email: '', topic: 'order', message: '' })
const sent = ref<string>()

/**
 * Send a message to the shop. Use when the user has a question or a problem with an order.
 * @tool
 * @input contactSchema
 */
function sendMessage () {
  sent.value = `${form.topic}: ${form.message}`
  return `Sent. We will reply to ${form.email}.`
}
</script>

<template>
  <form @submit.prevent="sendMessage">
    <label>Email <input
      v-model="form.email"
      type="email"
    ></label>
    <label>Topic <select v-model="form.topic">
      <option value="order">An order</option>
      <option value="other">Something else</option>
    </select></label>
    <label>Message <textarea v-model="form.message" /></label>
    <button type="submit">
      Send
    </button>
    <p data-testid="sent">
      {{ sent }}
    </p>
  </form>
</template>
