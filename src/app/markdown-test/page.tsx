'use client'

import React from 'react'
import { MessageContent, StreamingContent } from '@/components/markdown'

const testMarkdown = `# Markdown Test

This is a test of the markdown rendering capabilities.

## Features

### Lists
- **Unordered lists** work great
- They support *italic* and **bold** text
- And even \`inline code\`

### Ordered Lists
1. First item
2. Second item with [a link](https://example.com)
3. Third item

### Code Blocks

\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`)
  return {
    message: "Welcome to Agent Playground",
    timestamp: new Date().toISOString()
  }
}

// Call the function
hello("World")
\`\`\`

\`\`\`python
import numpy as np
import matplotlib.pyplot as plt

# Generate sample data
x = np.linspace(0, 10, 100)
y = np.sin(x)

# Create plot
plt.figure(figsize=(10, 6))
plt.plot(x, y, 'b-', linewidth=2)
plt.title('Sine Wave')
plt.xlabel('X axis')
plt.ylabel('Y axis')
plt.grid(True)
plt.show()
\`\`\`

### Tables

| Feature | Status | Notes | Description | Additional Info | Extra Column |
|---------|--------|-------|-------------|-----------------|--------------|
| Lists | ✅ | Working perfectly | Supports both ordered and unordered lists with nested items | Great for organizing content hierarchically | Very useful feature |
| Tables | ✅ | Responsive design with horizontal scroll | Tables now have max column width of 160px and overflow handling | Perfect for displaying tabular data | Excellent implementation |
| Code | ✅ | Syntax highlighting for multiple languages | Supports JavaScript, Python, Bash, and many more programming languages | Essential for technical documentation | Works great with copy button |
| Math | ✅ | LaTeX support with multiple notations | Supports both dollar notation and bracket notation for mathematical expressions | Perfect for scientific content | Renders beautifully |

### Wide Table Test

| Very Long Column Header Name | Another Extremely Long Column Header | Short | Medium Length Header | Yet Another Very Long Column Name | Final Column |
|------------------------------|--------------------------------------|-------|----------------------|-----------------------------------|--------------|
| This is a very long text content that should be truncated or wrapped properly | Another long content that tests the table overflow behavior | Short | Medium content here | More long content to test the horizontal scrolling feature | Last cell |
| Second row with long content | More test data for overflow | Test | Another test | Testing horizontal scroll | End |

### Math Expressions

Inline math: $E = mc^2$

Block math:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

LaTeX bracket notation:
\\[
f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n
\\]

Inline bracket notation: \\(\\alpha + \\beta = \\gamma\\)

Mixed with dollar numbers: This costs $5 and that costs $10.

### Blockquotes

> This is a blockquote.
> 
> It can span multiple lines and contains **formatted text**.

### Horizontal Rule

---

### SVG Graphics

Here's an SVG icon example:

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="48" height="48">
  <circle cx="11" cy="11" r="8"/>
  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
</svg>
\`\`\`

And a more complex SVG:

\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect x="10" y="10" width="80" height="80" fill="#3b82f6" rx="10"/>
  <circle cx="50" cy="50" r="20" fill="white"/>
  <text x="50" y="55" text-anchor="middle" fill="#3b82f6" font-family="Arial" font-size="12">SVG</text>
</svg>
\`\`\`

### Mixed Content

Here's some text with \`inline code\`, **bold text**, *italic text*, and a [link](https://github.com).

\`\`\`bash
# Install dependencies
npm install react-markdown remark-gfm remark-math rehype-highlight rehype-katex

# Run the development server
npm run dev
\`\`\`

That's all for now!`

export default function MarkdownTestPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-center mb-8">Markdown Rendering Test</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Static Message Content */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Static Message Content</h2>
            <div className="border rounded-lg p-4 bg-card group">
              <MessageContent content={testMarkdown} />
            </div>
          </div>

          {/* Streaming Content */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Streaming Content</h2>
            <div className="border rounded-lg p-4 bg-card group">
              <StreamingContent 
                content={testMarkdown} 
                isStreaming={false}
              />
            </div>
          </div>
        </div>

        <div className="text-center">
          <a 
            href="/" 
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            ← Back to Agent Playground
          </a>
        </div>
      </div>
    </div>
  )
}
