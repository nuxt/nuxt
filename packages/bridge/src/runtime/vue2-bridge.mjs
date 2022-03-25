import Vue from 'vue'

export { EffectScope, computed, createApp, createRef, customRef, defineAsyncComponent, defineComponent, del, effectScope, getCurrentInstance, getCurrentScope, h, inject, isRaw, isReactive, isReadonly, isRef, markRaw, nextTick, onActivated, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onDeactivated, onErrorCaptured, onMounted, onScopeDispose, onServerPrefetch, onUnmounted, onUpdated, provide, proxyRefs, reactive, readonly, ref, set, shallowReactive, shallowReadonly, shallowRef, toRaw, toRef, toRefs, triggerRef, unref, useAttrs, useCSSModule, useCssModule, useSlots, warn, watch, watchEffect, watchPostEffect, watchSyncEffect } from '@vue/composition-api'

export const isFunction = fn => fn instanceof Function

export { Vue as default }

// mock for vue-demi
export const Vue2 = Vue
export const isVue2 = true
export const isVue3 = false
export const install = () => {}
export const version = Vue.version
