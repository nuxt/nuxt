import type { Rule, Tree } from '@wandeljs/core'
import type { Identifier, OptionalKind, VariableDeclarationStructure } from 'ts-morph'
import { Node, Project, SyntaxKind, VariableDeclarationKind } from 'ts-morph'

class ContentsStore {
  private _project: Project = null!

  collection: Array<{ path: string, content: string }> = []

  get project () {
    if (!this._project) {
      this._project = new Project({ useInMemoryFileSystem: true, manipulationSettings: {
        usePrefixAndSuffixTextForRename: true,
      } })
    }

    return this._project
  }

  track (path: string, content: string) {
    this.collection.push({ path, content })
    this.project.createSourceFile(path, content, {})
  }
}

export default function update (tree: Tree): Rule {
  return migrateUseAsyncData(tree)
}

function migrateUseAsyncData (host: Tree): Rule {
  return () => {
    const contentsStore = new ContentsStore()
    host.visit((file) => {
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
        let statusDeclaration: OptionalKind<VariableDeclarationStructure> | undefined = undefined
        sourceFile.forEachChild((node) => {
          if (Node.isVariableStatement(node)) {
            const structure = node.getStructure()
            if (!statusDeclaration) {
              statusDeclaration = structure.declarations.find(declaration => declaration.name.includes('status'))
            }
            const declaration = structure.declarations.find(declaration => declaration.initializer?.includes('useAsyncData') && declaration.name.includes('pending'))
            if (declaration) {
              const identifiers = node.getDescendantsOfKind(SyntaxKind.Identifier)
              const identifier = identifiers.reduce((acc, identifier) => {
                const name = identifier.getFullText().trim()
                if (name === 'pending') {
                  return { ...acc, pending: identifier }
                } else if (name !== 'pending' && (identifier.compilerNode.parent as any).propertyName?.getFullText().trim() === 'pending') {
                  return { ...acc, pendingAlias: identifier }
                }
                return { ...acc }
              }, { pending: undefined, pendingAlias: undefined } as { pending: undefined | Identifier, pendingAlias: undefined | Identifier })
              const statusName = statusDeclaration ? 'dataStatus' : 'status'
              const startLineNumber = node.getStartLineNumber() + 1
              const name = identifier.pendingAlias ? identifier.pendingAlias.getFullText().trim() : 'pending'
              if (identifier.pendingAlias && identifier.pending) {
                sourceFile.replaceText([identifier.pending.getPos(), identifier.pendingAlias.getEnd()], statusDeclaration ? 'status: dataStatus' : 'status')
              } else {
                identifier.pending?.replaceWithText('status')
              }
              sourceFile.insertVariableStatement(startLineNumber, {
                isExported: false,
                isDefaultExport: false,
                hasDeclareKeyword: false,
                declarationKind: VariableDeclarationKind.Const,
                declarations: [
                  {
                    name,
                    initializer: `computed(() => ${statusName}.value === 'pending' || ${statusName}.value === 'idle')`,
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
