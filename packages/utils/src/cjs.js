export function clearRequireCache(id) {

  /*
    모듈을 require할 때마다 새로운 인스턴스가 생성되는 것이 아니라 캐싱된 객체 인스턴스를 재사용하는 것 입니다.
    key값으로 해당 모듈 파일의 경로를 갖게 되는데 key값이 삭제된다면 다음 require 요청시 다시 재로딩 하게됩니다. 
    다음 코드를 통해서 require.cache에 캐싱된 모듈을 확인해보겠습니다.
    Node.js 공식 Documentation에서 확인할 수 있듯이 한번 로딩(require)된 모듈은 require.cache라는 객체에 캐싱됩니다. 
  */
  const entry = require.cache[id]
  // entry가 없거나 id가 node_modules를 포함한 경우
  if (!entry || id.includes('node_modules')) {
    // 그냥 리턴
    return
  }

  // entry에 부모가 있으면
  if (entry.parent) {
    // entry.parent.children의 id가 인자로 전달받은 id(파일 경로)와 같지 않다면 필터링 
    // 최초에 id로 받은 파일 말고 다른 파일들이 필터링 되어서 나옴
    entry.parent.children = entry.parent.children.filter(e => e.id !== id)
  }

  // 최초로 받은 모듈의 children들도 같은 거 태우겠다
  for (const child of entry.children) {
    clearRequireCache(child.id)
  }

  // 최초로 받은 모듈의 캐시 제거 => 최초 파일의 부모와 형제들 빼고는 다 캐시 내역 delete 해서 사용하겠다는 말!
  delete require.cache[id]
}

export function scanRequireTree(id, files = new Set()) {
  const entry = require.cache[id]
  if (!entry || id.includes('node_modules') || files.has(id)) {
    return files
  }

  files.add(entry.id)

  for (const child of entry.children) {
    scanRequireTree(child.id, files)
  }

  return files
}
