<template>
  <div>
    <h1>Nuxt Chat</h1>
    <transition-group name="list" tag="ul">
      <li v-for="(message, index) in messages" :key="index">
        <component :is="message.component" :data="message.data"></component>
      </li>
    </transition-group>
  </div>
</template>

<script>
import streamMessages from '@/js/messages.js'
// Dynamic components
const components = {
  vText: () => import('@/components/text.vue').then(m => m.default),
  vImage: () => import('@/components/image.vue').then(m => m.default),
  vCode: () => import('@/components/code.vue').then(m => m.default)
}

export default {
  data: () => ({
    messages: []
  }),
  mounted () {
    // Listen to new messages
    streamMessages(async (message) => {
      // Make sure to wait for async chunk to be loaded before adding the message
      await components[message.component]()
      // Add the message to the list
      this.messages.push(message)
    })
  },
  components
}
</script>

<style scoped>
h1 {
  text-align: center;
  font-family: Helvetica, Arial, sans-serif;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  max-width: 300px;
  margin: auto;
}

ul li {
  display: block;
  width: 100%;
  border-radius: 20px;
  margin-bottom: 5px;
  font-family: Helvetica, Arial, sans-serif;
  background: white;
  border: 1px #ddd solid;
  overflow: hidden;
  opacity: 1;
}
.list-enter-active, .list-leave-active {
  transition: all 0.4s;
}
.list-enter, .list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
