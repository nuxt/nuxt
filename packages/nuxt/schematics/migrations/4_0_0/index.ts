import type { Rule, Tree } from '@wandeljs/core'
import {  Node, Project, SyntaxKind, VariableDeclarationKind } from 'ts-morph'
import { type SFCParseOptions, type SFCScriptCompileOptions, compileScript, parse } from '@vue/compiler-sfc'

class ContentsStore {
  private _project: Project = null!

  collection: Array<{ path: string, content: string }> = []

  get project () {
    if (!this._project) {
      this._project = new Project({ useInMemoryFileSystem: true })
    }

    return this._project
  }

  track (path: string, content: string) {
    this.collection.push({ path, content })
    this.project.createSourceFile(path, content)
  }
}

export function compileSFCScript (
  src: string,
  options?: Partial<SFCScriptCompileOptions>,
  parseOptions?: SFCParseOptions,
) {
  const { descriptor, errors } = parse(src, parseOptions)
  if (errors.length) {
    console.warn(errors[0])
  }
  return compileScript(descriptor, {
    ...options,
    id: 'someArbitraryMockId',
  })
}

export default function update (tree: Tree): Rule {
  return migrateUseAsyncData(tree)
}

function migrateUseAsyncData (host: Tree): Rule {
  return () => {
    const contentsStore = new ContentsStore()
    host.visit((file, entry) => {
      if (file.includes('.vue')) {
        host.beginUpdate(file)
        const content = host.read(file)?.toString()
        if (content && content.includes('useAsyncData')) {
          contentsStore.track(file, content)
        }
      }
    })

    for (const { path: sourcePath } of contentsStore.collection) {
      const sourceFile = contentsStore.project.getSourceFile(sourcePath)
      if (sourceFile) {
        sourceFile.forEachChild((node) => {
          if (Node.isVariableStatement(node)) {
            const structure = node.getStructure()
            const declaration = structure.declarations.find(declaration => declaration.initializer?.includes('useAsyncData') && declaration.name.includes('pending'))
            if (declaration) {
              const identifiers = node.getDescendantsOfKind(SyntaxKind.Identifier)
              const identifier = identifiers.find(x => x.getFullText().trim() === 'pending')
              identifier?.replaceWithText('status')
              sourceFile.insertVariableStatement(node.getStartLineNumber() + 1, {
                isExported: false,
                isDefaultExport: false,
                hasDeclareKeyword: false,
                declarationKind: VariableDeclarationKind.Const,
                declarations: [
                  {
                    name: 'pending',
                    initializer: `computed(() => status.value === 'pending' || status.value === 'idle')`,
                    hasExclamationToken: false,
                  },
                ],
              })
            }
          }
        })
        host.overwrite(sourcePath, sourceFile.getFullText())
      }
      return host
    }
  }
}
