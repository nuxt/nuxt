import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SchematicContext } from '@wandeljs/core'
import { Tree, UnitTestTree } from '@wandeljs/core'
import update from './index'

describe('Schematics Migration 4_0_0', () => {
  let tree: Tree

  function setup () {
    tree = new UnitTestTree(Tree.empty())
  }

  it('should convert basic scenario successfully', () => {
    setup()
    const t = update(tree)
    const file = fs.readFileSync(path.resolve(__dirname, './snapshots/basic/before.vue'))
    tree.create('test.vue', file)
    t(tree, {} as SchematicContext)
    const content = tree.read('test.vue')
    expect(content?.toString()).toMatchFileSnapshot('./snapshots/basic/after.vue')
  })

  it('should convert complex scenario successfully', () => {
    setup()
    const t = update(tree)
    const file = fs.readFileSync(path.resolve(__dirname, './snapshots/complex/before.vue'))
    tree.create('test.vue', file)
    t(tree, {} as SchematicContext)
    const content = tree.read('test.vue')
    expect(content?.toString()).toMatchFileSnapshot('./snapshots/complex/after.vue')
  })

  it('should not make any changes if not necessary', () => {
    setup()
    const t = update(tree)
    const file = fs.readFileSync(path.resolve(__dirname, './snapshots/no-edit/before.vue'))
    tree.create('test.vue', file)
    t(tree, {} as SchematicContext)
    const content = tree.read('test.vue')
    expect(content?.toString()).toMatchFileSnapshot('./snapshots/no-edit/after.vue')
  })
})
