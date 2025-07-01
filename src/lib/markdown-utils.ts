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
 * Fix bold text followed by list issue (both ordered and unordered)
 */
function fixBoldList(text: string): string {
  // 匹配粗体后直接跟有序列表的情况：**text**\n1. 或 **text**1.
  // 在1.前面添加一个换行符
  let processedText = text.replace(/(\*\*[^*]+\*\*)\s*\n?(\d+\.\s)/g, '$1\n\n$2')

  // 匹配粗体后直接跟无序列表的情况：**text**\n- 或 **text**-
  // 在-前面添加一个换行符
  processedText = processedText.replace(/(\*\*[^*]+\*\*)\s*\n?(-\s)/g, '$1\n\n$2')

  return processedText
}

/**
 * Process text to handle math expressions properly
 */
export function processMarkdownText(text: string): string {
  // First escape dollar numbers, then convert bracket notation, then fix bold+list issue
  let processedText = escapeDollarNumber(text)
  processedText = escapeBrackets(processedText)
  processedText = fixBoldList(processedText)
  return processedText
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
