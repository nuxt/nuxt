<template>
  <div class="profile">
    <ContentLoader v-if="pending" width="400" height="60">
      <rect
        x="70"
        y="15"
        rx="4"
        ry="4"
        width="117"
        height="6.4"
      />
      <rect
        x="70"
        y="35"
        rx="3"
        ry="3"
        width="85"
        height="6.4"
      />
      <circle cx="30" cy="30" r="30" />
    </ContentLoader>
    <div v-else>
      <img :src="data.avatar" height="55" width="55">
      <div>
        {{ data.text }}
        <br>
        {{ data.text }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ContentLoader } from 'vue-content-loader'
export default defineNuxtComponent({
  components: { ContentLoader },
  setup () {
    const { data, pending } = asyncData(
      'time',
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                text: 'finally done',
                avatar:
                  'https://images.unsplash.com/photo-1517365830460-955ce3ccd263?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=256&h=256&q=80'
              }),
            2500
          )
        ),
      { defer: true, server: false }
    )

    return {
      data,
      pending
    }
  }
})
</script>

<style>
.profile {
  width: 400px;
  height: 60px;
}
.profile img {
  border-radius: 50%;
}
.profile > div {
  display: flex;
  align-items: center;
  gap: 1rem;
}
</style>
