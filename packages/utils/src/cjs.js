export function clearRequireCache(id) {

  /*
    모듈을 require할 때마다 새로운 인스턴스가 생성되는 것이 아니라 캐싱된 객체 인스턴스를 재사용하는 것 입니다.
    key값으로 해당 모듈 파일의 경로를 갖게 되는데 key값이 삭제된다면 다음 require 요청시 다시 재로딩 하게됩니다. 
    Node.js 공식 Documentation에서 확인할 수 있듯이 한번 로딩(require)된 모듈은 require.cache라는 객체에 캐싱됩니다. 
  */
  id;
  debugger;
  const entry = require.cache[id]
  // entry가 없거나 id가 node_modules를 포함한 경우
  if (!entry || id.includes('node_modules')) {
    debugger
    // 그냥 리턴
    return
  }

  // entry에 부모가 있으면
  if (entry.parent) {
    debugger
    // 부모에게서 자기 자신 빼고 필터링
    entry.parent.children = entry.parent.children.filter(e => e.id !== id)
  }

  // entry의 children들도 같은 거 태우겠다 => 재귀함수
  for (const child of entry.children) {
    clearRequireCache(child.id)
  }

  debugger
  // 자기가 마지막 아이일 때 캐시 제거
  delete require.cache[id]
}

// Set은 중복되지 않은, 순서들의 자료 구조임
export function scanRequireTree(id, files = new Set()) {
  // nuxtConfigFiles의 cache 
  const entry = require.cache[id]
  // 캐시 없거나 node_modules이거나 이미 Set에 추가가 되었으면 
  if (!entry || id.includes('node_modules') || files.has(id)) {
    return files
  }

  // files Set에 추가
  files.add(entry.id)

  for (const child of entry.children) {
    scanRequireTree(child.id, files)
  }

  // 요구되는 파일 트리 Set으로 만들어서 리턴하겠다
  return files
}
