const DEFINE_COMPONENT_VUE = '_defineComponent('
const DEFINE_COMPONENT_NUXT = '_defineNuxtComponent('

export default function NuxtSetupLoader (code: string) {
  if (code && code.includes(DEFINE_COMPONENT_VUE)) {
    // TODO: Add sourcemap hints
    code = 'import { defineNuxtComponent as _defineNuxtComponent } from "@nuxt/app"\n' + code.replace(DEFINE_COMPONENT_VUE, DEFINE_COMPONENT_NUXT)
  }
  return code
}
