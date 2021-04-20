<template>
  <div class="w-full flex min-h-screen">
    <!-- Aside -->
    <aside class="w-100 min-h-screen max-h-screen bg-gray-100 px-5 pt-6 fixed">
      <NuxtLink to="/docs">
        <svg width="133" height="32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M59.2018 7.27344h4.9825L74.7434 24.5242V7.27344h4.5992V31.7169h-4.9483L63.8011 14.5021v17.2148h-4.5993V7.27344zM99.9008 31.7168h-4.286v-2.7304c-.9757 1.9215-2.9612 3.0034-5.4694 3.0034-3.9727 0-6.5524-2.8635-6.5524-6.9846v-10.889h4.2859v9.988c0 2.4095 1.4644 4.0853 3.6594 4.0853 2.4043 0 4.0765-1.8857 4.0765-4.4693v-9.604h4.286v17.6006zM114.816 31.7168l-4.113-5.8669-4.112 5.8669h-4.565l6.343-9.1843-5.854-8.4163h4.669l3.519 5.0648 3.484-5.0648h4.705l-5.89 8.4163 6.343 9.1843h-4.529zM128.057 8.80908v5.30712h4.878v3.5973h-4.878v8.7371c0 .2934.116.5749.323.7825.207.2077.487.3245.78.325h3.775v4.1518h-2.823c-3.833 0-6.341-2.2354-6.341-6.1433v-7.8497h-3.45v-3.6007h2.164c1.01 0 1.597-.6024 1.597-1.599V8.80908h3.975z" fill="#243746" /> <path d="M26.3684 31.6843h17.4725c.5549.0001 1.1001-.1463 1.5807-.4244.4806-.2781.8797-.6782 1.1571-1.1599.2773-.4817.4232-1.0281.423-1.5843-.0003-.5562-.1466-1.1024-.4244-1.5839L34.8432 6.56333c-.2773-.48161-.6763-.88155-1.1568-1.15961-.4805-.27807-1.0256-.42446-1.5804-.42446-.5549 0-1.1.14639-1.5805.42446-.4805.27806-.8794.678-1.1568 1.15961l-3.0003 5.21157-5.8662-10.19106c-.2776-.48157-.6767-.881448-1.1574-1.159464C18.8642.14636 18.319 0 17.7641 0c-.555 0-1.1001.14636-1.5808.424376-.4806.278016-.8798.677894-1.1573 1.159464L.424398 26.9318C.146615 27.4133.00024176 27.9595 3e-7 28.5157c-.00024147.5562.1456577 1.1026.4230227 1.5843s.676417.8818 1.157017 1.1599c.4806.2781 1.0258.4245 1.58077.4244H14.1286c4.3456 0 7.5502-1.913 9.7554-5.645l5.3536-9.2917 2.8675-4.9727 8.606 14.9367H29.2376l-2.8692 4.9727zm-12.4186-4.9778l-7.65412-.0017L17.7692 6.79029l5.7248 9.95731-3.833 6.6552c-1.4644 2.4215-3.128 3.3037-5.7112 3.3037z" fill="#00DC82" /></svg>
      </NuxtLink>
      <nav class="px-5 pt-6 h-full overflow-y-auto">
        <ol type="i" class="list-none">
          <li v-for="cat of menu" :key="cat.key">
            <h2 class="text-xl text-gray-900 font-semibold my-2">
              {{ cat.title }}
            </h2>
            <ol class="list-none">
              <li v-for="item of cat.items" :key="item.key">
                <NuxtLink :to="`/docs/${cat.key}/${item.key}`" class="no-underline text-gray-700">
                  {{ item.title }}
                </NuxtLink>
              </li>
            </ol>
          </li>
        </ol>
        <nav />
      </nav>
    </aside>
    <!-- Main -->
    <main class="w-full p-10 overflow-auto ml-100">
      <NuxtPage />
    </main>
  </div>
</template>

<script>
import 'windi.css'
import { defineNuxtComponent } from '@nuxt/app'
import { useHead } from '@vueuse/head'
import { useContent } from '~/modules/content/runtime'

export default defineNuxtComponent({
  setup () {
    const { data: menu } = useContent('/menu.json')

    useHead({ title: 'Nuxt Documentation' })

    return {
      menu
    }
  }
})
</script>
