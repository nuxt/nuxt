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
}
