const DEFINE_COMPONENT_VUE = '_defineComponent('
const DEFINE_COMPONENT_NUXT = '_defineNuxtComponent('

export default function NuxtSetupLoader (code: string, map: any) {
  if (code && code.includes(DEFINE_COMPONENT_VUE)) {
    code = 'import { defineNuxtComponent as _defineNuxtComponent } from "@nuxt/app";' + code.replace(DEFINE_COMPONENT_VUE, DEFINE_COMPONENT_NUXT)
  }
  this.callback(null, code, map)
}
