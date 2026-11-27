/** A tokenizer with the signature of the `js-tokens` default export. */
export type JsTokenizer = (code: string, options?: { jsx?: boolean }) => Iterable<{ type: string, value: string, closed?: boolean }>

// A decorator `@` is followed by code, so a `@` is dropped only when the text after
// it cannot continue a decorator. This holds whether or not the `@` is in a comment,
// string or regex, and keeps `/*@__PURE__*/`, scoped package names and most JSDoc
// tags away from `hasDecoratorSyntax`.
const NOT_COMMENT = String.raw`\/(?![*/])`
// ASCII that cannot follow `@x`, start a member name after `@x *`, or follow `@x`
// where only a class expression is allowed (after `*`, or a `/` not closing a comment).
const NOT_AFTER_DECORATOR = String.raw`[!%&)+,\-:;=>?\]^\x60{|}~]`
const NOT_AFTER_STAR = String.raw`[!%&()*+,\-:;<=>?@\]^\x60{|}~]`
const NOT_IN_EXPRESSION = String.raw`[!"#%&')*+,\-:;=>?[\]^\x60{|}~]`
const EXPRESSION_BEFORE = String.raw`(?<=(?:\*|(?<!\*)\/)[ \t]*)`
const NEVER_DECORATOR = String.raw`[\w$]+\s*(?:${NOT_AFTER_DECORATOR}|$|${NOT_COMMENT}|\*\s*(?:${NOT_AFTER_STAR}|$|${NOT_COMMENT}))`
const NEVER_DECORATOR_IN_EXPRESSION = String.raw`[\w$]+\s*(?:${NOT_IN_EXPRESSION}|$|${NOT_COMMENT}|(?<=\s)(?!class(?![\w$]))[A-Za-z_$])`

/** Matches every module with decorator syntax, and some without. Cheap enough for a bundler's code filter. */
export const MAY_CONTAIN_DECORATOR_RE = new RegExp(String.raw`(?!${EXPRESSION_BEFORE}@${NEVER_DECORATOR_IN_EXPRESSION})@(?!${NEVER_DECORATOR})`)

/** Whether `code` may contain decorator syntax, ignoring `@` in comments and closed string literals. */
export function hasDecoratorSyntax (code: string, tokenize: JsTokenizer, jsx = false): boolean {
  // TypeScript generics can be tokenised as JSX, so JSX input is also checked without JSX
  return (jsx && hasUnquotedAt(tokenize(code, { jsx: true }))) || hasUnquotedAt(tokenize(code))
}

function hasUnquotedAt (tokens: ReturnType<JsTokenizer>): boolean {
  for (const token of tokens) {
    if (!token.value.includes('@')) {
      continue
    }

    switch (token.type) {
      case 'HashbangComment':
      case 'SingleLineComment':
      case 'TemplateHead':
      case 'TemplateMiddle':
        continue
      case 'MultiLineComment':
      case 'StringLiteral':
      case 'NoSubstitutionTemplate':
      case 'TemplateTail':
      case 'JSXString':
        // An unclosed token can consume code that follows it. Let Babel parse
        // ambiguous input instead of potentially hiding a real decorator.
        if (token.closed) {
          continue
        }
    }

    return true
  }

  return false
}
