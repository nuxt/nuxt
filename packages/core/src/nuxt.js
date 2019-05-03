
import isPlainObject from 'lodash/isPlainObject'
import consola from 'consola'

import { defineAlias } from '@nuxt/utils'
import { getNuxtConfig } from '@nuxt/config'
import { Server } from '@nuxt/server'

import { version } from '../package.json'

import ModuleContainer from './module'
import Hookable from './hookable'
import Resolver from './resolver'

// 아까 생성한 options들 받아왔음
export default class Nuxt extends Hookable {
  // constructor
  constructor(options = {}) {
    super()

    // Assign options and apply defaults
    // 디폴트로 쓸 nuxtConfig 가져옴
    this.options = getNuxtConfig(options)

    // Create instance of core components
    // 아래 두 클래스의 인스턴스 생성함
    /** 다시 확인 */
    this.resolver = new Resolver(this)
    this.moduleContainer = new ModuleContainer(this)
    /** 다시 확인 */
    
    // Deprecated hooks
    this._deprecatedHooks = {
      'render:context': 'render:routeContext',
      'render:routeContext': 'vue-renderer:afterRender',
      'showReady': 'webpack:done' // Workaround to deprecate showReady
    }

    // Add Legacy aliasesx
    defineAlias(this, this.resolver, ['resolveAlias', 'resolvePath'])
    // this showReady 부르면 this callHook 리턴됨, Hookable 클래스의 메소드임
    this.showReady = () => { this.callHook('webpack:done') }

    // Init server
    // server false 아니면
    if (this.options.server !== false) {
      // server 초기화함
      this._initServer()
    }

    // Call ready
    if (this.options._ready !== false) {
      // 이 nuxt 객체의 ready()함수 실행하는데, catch해서 에러 파악함
      this.ready().catch((err) => {
        consola.fatal(err)
      })
    }
  }

  static get version() {
    return (global.__NUXT && global.__NUXT.version) || `v${version}`
  }

  ready() {
    if (!this._ready) {
      // 아래의 this.init 메소드
      this._ready = this._init()
    }
    return this._ready
  }

  async _init() {
    if (this._initCalled) {
      return this
    }
    this._initCalled = true

    // Add hooks
    //  Object constructor or one with a [[Prototype]] of null 인지
    if (isPlainObject(this.options.hooks)) {
      // options.hooks가 javascript object이면 실행
      this.addHooks(this.options.hooks)
    } else if (typeof this.options.hooks === 'function') {
      // function이면 options.hooks 실행
      this.options.hooks(this.hook)
    }

    // Await for modules
    // 위의 moduleContainer 인스턴스 ready()함수 실행
    await this.moduleContainer.ready()

    // Await for server to be ready
    if (this.server) {
      // 위의 server 인스턴스 ready() 함수 실행
      await this.server.ready()
    }

    // Call ready hook
    await this.callHook('ready', this)

    return this
  }

  _initServer() {
    if (this.server) {
      return
    }
    // Server 클래스에 해당 Nuxt 인스턴스 넣겠다
    this.server = new Server(this)
    // renderer는 이제 Server 인스턴스가 됨
    this.renderer = this.server
    // render는 this.server.app
    this.render = this.server.app
    defineAlias(this, this.server, ['renderRoute', 'renderAndGetWindow', 'listen'])
  }

  async close(callback) {
    await this.callHook('close', this)

    if (typeof callback === 'function') {
      await callback()
    }

    this.clearHooks()
  }
}
