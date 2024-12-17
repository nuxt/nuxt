import { ScopeTracker } from '../../src/core/utils/parse'

export class TestScopeTracker extends ScopeTracker {
  getScopes () {
    return this.scopes
  }

  getScopeIndexKey () {
    return this.scopeIndexKey
  }

  getScopeIndexStack () {
    return this.scopeIndexStack
  }

  isDeclaredInScope (identifier: string, scope: string) {
    const oldKey = this.scopeIndexKey
    this.scopeIndexKey = scope
    const result = this.isDeclared(identifier)
    this.scopeIndexKey = oldKey
    return result
  }

  getDeclarationFromScope (identifier: string, scope: string) {
    const oldKey = this.scopeIndexKey
    this.scopeIndexKey = scope
    const result = this.getDeclaration(identifier)
    this.scopeIndexKey = oldKey
    return result
  }
}
