/**
 * Escape dollar numbers to prevent them from being treated as math
 */
function escapeDollarNumber(text: string): string {
  return text.replace(/\$(\d+)/g, '\\$$$1')
}

/**
 * Convert LaTeX bracket notation to dollar notation for better compatibility
 */
function escapeBrackets(text: string): string {
  const pattern = /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g
  return text.replace(pattern, (match, codeBlock, squareBracket, roundBracket) => {
    if (codeBlock) {
      return codeBlock
    } else if (squareBracket) {
      return `$$${squareBracket}$$`
    } else if (roundBracket) {
      return `$${roundBracket}$`
    }
    return match
  })
}

/**
 * Process text to handle math expressions properly
 */
export function processMarkdownText(text: string): string {
  // First escape dollar numbers, then convert bracket notation
  const escapedText = escapeBrackets(escapeDollarNumber(text))
  return escapedText
}

/**
 * Check if text contains math expressions
 */
export function containsMath(text: string): boolean {
  // Check for dollar notation or bracket notation
  const mathPatterns = [
    /\$\$[\s\S]*?\$\$/,  // Block math
    /\$[^$\n]*?\$/,      // Inline math
    /\\\[[\s\S]*?\\\]/,  // Block bracket notation
    /\\\(.*?\\\)/        // Inline bracket notation
  ]
  
  return mathPatterns.some(pattern => pattern.test(text))
}
