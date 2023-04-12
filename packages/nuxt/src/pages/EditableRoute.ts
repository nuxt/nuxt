import type { NuxtPage } from '@nuxt/schema'
import type { EditableTreeNode } from 'unplugin-vue-router'

/**
 * TODO: after checking https://github.dev/intlify/routing we need to ensure that a module author can set the children of a route with the following properties:
  - name?: string
  - path: string
  - file?: string // for nuxt bridge & nuxt 3
  - children?: Route[]
 */

export class NuxtPageEditable {
  private _node: EditableTreeNode
  private _children: NuxtPage[]

  constructor (node: EditableTreeNode) {
    this._node = node
    this._children = createChildrenProxy(node)
  }

  get name () {
    return this._node.name
  }

  set name (name: string) {
    this._node.name = name
  }

  // TODO: is it fullPath or path?
  get path () {
    return this._node.path
  }

  // TODO: is it fullPath or path?
  set path (path: string) {
    this._node.path = path
  }

  get file () {
    return this._node.components.get('default')
  }

  set file (file: string | undefined) {
    if (!file) {
      this._node.components.delete('default')
    } else {
      this._node.components.set('default', file)
    }
  }

  // FIXME: I need to create a proxy on children array to work with splice and other functions

  get children (): NuxtPage[] {
    return this._children
  }

  set children (routes: NuxtPage[]) {
    // TODO: remove all children then add the new ones
    throw new Error('Not implemented')
  }
}

function createChildrenProxy (node: EditableTreeNode): NuxtPage[] {
  const target: NuxtPage[] = node.children.map(n => new NuxtPageEditable(n))

  console.log('🪄 proxified')
  const self = new Proxy<NuxtPage[]>(target, {
    get (target, p, receiver) {
      if (p === 'push') {
        function push (target: NuxtPage[], ...routes: NuxtPage[]) {
          console.log('🪄 push()', routes)
          routes.forEach((route) => {
            const routeNode = node.insert(route.path, route.path)
            const nuxtPage = new NuxtPageEditable(routeNode)
            routeNode.name = route.name
            // FIXME: add once made writable
            // routeNode.alias = route.alias
            if (route.meta) {
              routeNode.addToMeta(route.meta)
            }
            // FIXME: implement
            // routeNode.redirect = route.redirect
            // .... others
            if (route.file) {
              console.log('🪄 set file', route.file)
              routeNode.components.set('default', route.file)
            }
            route.children?.forEach((child) => {
              // FIXME:
              push(nuxtPage.children, child)
            })

            return target.push(nuxtPage)
          })
        }

        return push.bind(null, target)
      }

      return Reflect.get(target, p, receiver)
    }
  })

  return self
}
