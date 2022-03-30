;; https://developer.mozilla.org/en-US/docs/WebAssembly/Understanding_the_text_format
;; https://webassembly.github.io/wabt/demo/wat2wasm/
(module
  (func (export "sum") (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.add))
