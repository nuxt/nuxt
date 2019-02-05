export const forceExitTimeout = 5

export const startSpaces = 2
export const optionSpaces = 2

// 80% of terminal column width
// this is a fn because console width can have changed since startup
export const maxCharsPerLine = () => (process.stdout.columns || 100) * 80 / 100
