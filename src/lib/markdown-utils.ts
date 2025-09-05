/**
 * Escape dollar numbers to prevent them from being treated as math
 */
function escapeDollarNumber(text: string): string {
  return text.replace(/\$(\d+)/g, '\\$$$1')
}

/**
 * Convert LaTeX bracket notation to dollar notation for better compatibility
 * 使用更安全的正则表达式，避免在代码块内进行转换
 */
function escapeBrackets(text: string): string {
  // 暂时简化这个函数，直接返回原文本，不做任何处理
  // 这样我们可以确定问题是否在这个函数中
  return text
}

/**
 * Fix bold text followed by list issue (both ordered and unordered)
 */
function fixBoldList(text: string): string {
  // 先按行分割文本
  const lines = text.split('\n')
  const processedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 如果当前行是标题（以#开头），直接保留，不进行处理
    if (line.match(/^\s*#{1,6}\s/)) {
      processedLines.push(line)
      continue
    }

    // 对非标题行进行粗体+列表的修复处理
    let processedLine = line

    // 匹配粗体后直接跟有序列表的情况：**text**1.
    processedLine = processedLine.replace(/(\*\*[^*]+\*\*)(\d+\.\s)/g, '$1\n\n$2')

    // 匹配粗体后直接跟无序列表的情况：**text**-
    processedLine = processedLine.replace(/(\*\*[^*]+\*\*)(-\s)/g, '$1\n\n$2')

    processedLines.push(processedLine)
  }

  return processedLines.join('\n')
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
