'use client'

import React, { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import { Copy, Check, WrapText } from 'lucide-react'
import { processMarkdownText } from '@/lib/markdown-utils'
import { useCodeWrap } from '@/hooks/use-code-wrap'

// Import highlight.js styles
import 'highlight.js/styles/github-dark.css'
// Import KaTeX styles
import 'katex/dist/katex.min.css'

interface MarkdownContentProps {
  content: string
  className?: string
}

// 检测是否为实际代码的辅助函数
const isActualCode = (content: string, language: string): boolean => {
  // 如果有明确的编程语言标识，认为是代码
  const programmingLanguages = [
    'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 'c', 'cpp', 'csharp', 'cs',
    'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'scala', 'html', 'css', 'scss', 'sass',
    'xml', 'json', 'yaml', 'yml', 'sql', 'bash', 'sh', 'powershell', 'dockerfile', 'makefile',
    'r', 'matlab', 'perl', 'lua', 'dart', 'elixir', 'erlang', 'haskell', 'clojure', 'scheme',
    'lisp', 'assembly', 'asm', 'vhdl', 'verilog', 'solidity', 'graphql', 'jsx', 'tsx', 'vue',
    'svelte', 'angular', 'react', 'nodejs', 'express', 'django', 'flask', 'spring', 'laravel'
  ]

  if (programmingLanguages.includes(language.toLowerCase())) {
    return true
  }

  // 如果语言是 'text', 'plain', 'txt' 或为空，检查内容特征
  const textLanguages = ['text', 'plain', 'txt', '']
  if (textLanguages.includes(language.toLowerCase())) {
    // 检查是否包含代码特征
    const codePatterns = [
      /function\s+\w+\s*\(/,           // 函数定义
      /class\s+\w+/,                  // 类定义
      /require\s*\(/,                 // require 语句
      /def\s+\w+\s*\(/,              // Python 函数定义
      /\w+\s*=\s*function/,          // 函数赋值
      /\w+\s*:\s*function/,          // 对象方法
      /console\.log\s*\(/,           // console.log
      /print\s*\(/,                  // print 函数
      /if\s*\(.+\)\s*{/,            // if 语句
      /for\s*\(.+\)\s*{/,           // for 循环
      /while\s*\(.+\)\s*{/,         // while 循环
    ]

    return codePatterns.some(pattern => pattern.test(content))
  }

  // 其他情况默认认为是代码
  return true
}

const MarkdownContentComponent = function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const { isWrapEnabled, toggleWrap } = useCodeWrap()

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(text)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  // Process the content to handle math expressions properly - 使用 useMemo 缓存
  const processedContent = useMemo(() => processMarkdownText(content), [content])

  // 缓存插件配置 - 配置rehypeHighlight以避免处理问题
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], [])
  const rehypePlugins = useMemo(() => [
    [rehypeHighlight, { 
      detect: false, // 禁用自动语言检测，可能导致问题
      subset: false  // 不限制语言子集
    }], 
    rehypeKatex
  ], [])

  // 缓存 ReactMarkdown 的 components 配置，避免每次重新创建
  const markdownComponents = useMemo(() => ({
          // Code blocks with syntax highlighting and copy button
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')

            // 从 node 或 children 中提取原始文本内容
            let codeString = ''

            if (node && node.children && node.children[0] && node.children[0].value) {
              // 优先从 AST node 中获取原始文本
              codeString = node.children[0].value
            } else {
              // 递归提取所有文本内容，包括嵌套结构中的文本
              const extractText = (element: any): string => {
                if (typeof element === 'string') {
                  return element
                }
                if (typeof element === 'number') {
                  return String(element)
                }
                if (React.isValidElement(element)) {
                  // 如果是React元素，递归提取其children中的文本
                  const props = element.props
                  if (props && props.children) {
                    if (Array.isArray(props.children)) {
                      return props.children.map(extractText).join('')
                    } else {
                      return extractText(props.children)
                    }
                  }
                }
                if (Array.isArray(element)) {
                  return element.map(extractText).join('')
                }
                if (element && typeof element === 'object' && element.props && element.props.children) {
                  if (Array.isArray(element.props.children)) {
                    return element.props.children.map(extractText).join('')
                  }
                  return extractText(element.props.children)
                }
                return ''
              }

              if (Array.isArray(children)) {
                codeString = children.map(extractText).join('')
              } else {
                codeString = extractText(children)
              }
              
              // 移除末尾的换行符（如果有的话）
              codeString = codeString.replace(/\n$/, '')
            }

            const language = match ? match[1] : ''
            // 检查是否是代码块：有语言标识或者包含换行符
            const isCodeBlock = match || codeString.includes('\n')
            const inline = !isCodeBlock

            // 检查是否是 SVG 代码
            const isSvg = language === 'svg' || (language === 'xml' && codeString.trim().startsWith('<svg'))

            // 检查是否为实际代码
            const isCode = isActualCode(codeString, language)


            return !inline ? (
              <div className="relative group my-4">
                <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-3 py-1.5 text-xs rounded-t-lg">
                  <span className="font-mono text-xs uppercase tracking-wide">
                    {language || 'plain'}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={toggleWrap}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                        isWrapEnabled 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                      title={isWrapEnabled ? "Disable word wrap" : "Enable word wrap"}
                    >
                      <WrapText size={12} />
                      <span className="text-xs">Wrap</span>
                    </button>
                    <button
                      onClick={() => copyToClipboard(codeString)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                      title="Copy code"
                    >
                      {copiedCode === codeString ? (
                        <>
                          <Check size={12} />
                          <span className="text-xs">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span className="text-xs">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <pre className={`bg-gray-900 text-gray-100 p-3 rounded-b-lg m-0 text-xs ${
                  isWrapEnabled 
                    ? 'whitespace-pre-wrap break-words overflow-wrap-anywhere text-left w-full' 
                    : (isCode ? 'overflow-x-auto' : 'whitespace-pre-wrap break-words overflow-wrap-anywhere')
                }`}>
                  <code 
                    className={`${className} ${isWrapEnabled ? 'block w-full' : ''}`} 
                    style={isWrapEnabled ? { 
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      width: '100%',
                      display: 'block'
                    } : {}}
                    {...props}
                  >
                    {children}
                  </code>
                </pre>

                {/* SVG 预览 */}
                {isSvg && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 text-center font-medium">
                      SVG Preview
                    </div>
                    <div className="flex justify-center">
                      <div
                        className="max-w-full max-h-96 overflow-auto bg-white dark:bg-gray-900 p-4 rounded border"
                        dangerouslySetInnerHTML={{ __html: codeString }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono text-red-600 dark:text-red-400" {...props}>
                {children}
              </code>
            )
          },

          // Tables with proper styling
          table: ({ children }: any) => (
            <div className="my-4 overflow-x-auto border border-gray-300 dark:border-gray-600 rounded-lg">
              <table className="border-collapse text-xs">
                {children}
              </table>
            </div>
          ),

          thead: ({ children }: any) => (
            <thead className="bg-gray-50 dark:bg-gray-800">
              {children}
            </thead>
          ),

          th: ({ children }: any) => (
            <th className="border-r border-b border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800">
              {children}
            </th>
          ),

          tbody: ({ children }: any) => (
            <tbody>
              {children}
            </tbody>
          ),

          tr: ({ children, ...props }: any) => {
            // 检查是否是表头行
            const isHeaderRow = props.node?.tagName === 'tr' && props.node?.parent?.tagName === 'thead'

            if (isHeaderRow) {
              return <tr>{children}</tr>
            }

            // 为表体行添加斑马线效果
            return (
              <tr className="even:bg-gray-50 dark:even:bg-gray-800/50 odd:bg-white dark:odd:bg-transparent">
                {children}
              </tr>
            )
          },

          td: ({ children }: any) => (
            <td className="border-r border-b border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-700 dark:text-gray-300">
              {children}
            </td>
          ),

          // Lists with proper spacing
          ul: ({ children }: any) => (
            <ul className="list-disc list-outside space-y-1 my-4 ml-6 pl-2">
              {children}
            </ul>
          ),

          ol: ({ children }: any) => (
            <ol className="list-decimal list-outside space-y-1 my-4 ml-6 pl-2">
              {children}
            </ol>
          ),

          li: ({ children }: any) => (
            <li className="text-gray-700 dark:text-gray-300">
              <span className="inline">
                {children}
              </span>
            </li>
          ),

          // Headings with proper hierarchy
          h1: ({ children }: any) => (
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
              {children}
            </h1>
          ),

          h2: ({ children }: any) => (
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-5 mb-3">
              {children}
            </h2>
          ),

          h3: ({ children }: any) => (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">
              {children}
            </h3>
          ),

          h4: ({ children }: any) => (
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-2">
              {children}
            </h4>
          ),

          h5: ({ children }: any) => (
            <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-2">
              {children}
            </h5>
          ),

          h6: ({ children }: any) => (
            <h6 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-2">
              {children}
            </h6>
          ),

          // Paragraphs with proper spacing
          p: ({ children }: any) => (
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed my-3">
              {children}
            </p>
          ),

          // Links with proper styling
          a: ({ href, children }: any) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
            >
              {children}
            </a>
          ),

          // Blockquotes
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 my-4 bg-gray-50 dark:bg-gray-800 italic">
              {children}
            </blockquote>
          ),

          // Horizontal rules
          hr: () => (
            <hr className="border-gray-300 dark:border-gray-600 my-6" />
          ),

          // Strong and emphasis
          strong: ({ children }: any) => (
            <strong className="font-bold text-gray-900 dark:text-gray-100 inline">
              {children}
            </strong>
          ),

          em: ({ children }: any) => (
            <em className="italic text-gray-700 dark:text-gray-300">
              {children}
            </em>
          ),
  }), [copiedCode, copyToClipboard])


  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}

// 使用 React.memo 包装组件，只有当 content 或 className 变化时才重新渲染
export const MarkdownContent = React.memo(MarkdownContentComponent, (prevProps, nextProps) => {
  return prevProps.content === nextProps.content && prevProps.className === nextProps.className
})
