<template>
  <div>
    <ClientScript ref="clientScript" class="client-only-script" foo="bar" />
    <ClientSetupScript
      ref="clientSetupScript"
      class="client-only-script-setup"
      foo="hello"
    >
      <template #test>
        <BreakServerComponent />
        <div class="slot-test">
          Hello
          <BreaksServer />
        </div>
      </template>
    </ClientSetupScript>
    <ClientOnly>
      Should not be server rendered.
      <BreakServerComponent />
      <template #fallback>
        <div>Fallback</div>
      </template>
    </ClientOnly>
    <!-- ensure multi root node components are correctly rendered (Fragment) -->
    <ClientMultiRootNode class="multi-root-node" />
    <ClientMultiRootNodeScript class="multi-root-node-script" />

    <!-- ensure components with a single single child are correctly rendered -->
    <ClientStringChildStateful ref="stringStatefulComp" class="string-stateful" />
    <ClientStringChildStatefulScript
      ref="stringStatefulScriptComp"
      class="string-stateful-script"
    />
    <ClientNoState class="no-state" />
    <!-- ensure directives are correctly passed -->
    <ClientStringChildStateful v-show="show" class="string-stateful-should-be-hidden" />
    <ClientSetupScript v-show="show" class="client-script-should-be-hidden" foo="bar" />
    <ClientStringChildStatefulScript
      v-show="show"
      class="string-stateful-script-should-be-hidden"
    />
    <ClientNoState v-show="show" class="no-state-hidden" />

    <button class="test-ref-1" @click="stringStatefulComp.add">
      increment count
    </button>
    <button class="test-ref-2" @click="stringStatefulScriptComp.add">
      increment count
    </button>
    <button class="test-ref-3" @click="clientScript.add">
      increment count
    </button>
    <button class="test-ref-4" @click="clientSetupScript.add">
      increment count
    </button>

    <button id="show-all" @click="show = true">
      Show all
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue'
// bypass client import protection to ensure this is treeshaken from .client components
import BreaksServer from '~~/components/BreaksServer.client'

type Comp = Ref<{ add: () => void }>

const stringStatefulComp = ref(null) as any as Comp
const stringStatefulScriptComp = ref(null) as any as Comp
const clientScript = ref(null) as any as Comp
const clientSetupScript = ref(null) as any as Comp
const BreakServerComponent = defineAsyncComponent(() => {
  return import('./../components/BreaksServer.client')
})

const show = ref(false)
</script>
