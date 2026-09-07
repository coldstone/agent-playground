# Agent Playground 🤖

[![Agent Playground](https://img.shields.io/badge/Agent-Playground-blue.svg)](https://github.com/coldstone/agent-playground)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/agent-playground.svg)](https://www.npmjs.com/package/agent-playground)

A development and debugging platform for AI agents. Agent Playground lets you build, run and inspect
agents that reach the outside world through four kinds of tools — your own **local HTTP tools**,
**MCP servers** over Streamable HTTP, **Agent Skills** written as `SKILL.md`, and a built-in
**Web Fetch** that reads any public URL — against any of a dozen LLM providers. Everything runs in the browser: agents, tools, skills and conversations are
stored locally in IndexedDB, and API keys never leave your machine.

![Screenshot of Agent Playground](screenshot-0-agent-playground.png)

![Screenshot of Agent Playground](screenshot-agent-playground.png)

> **New in 0.3.0:** MCP servers (Streamable HTTP, dual-era) and Agent Skills (`SKILL.md`), both usable in every conversation.
>
> **New in 0.3.1:** built-in **Web Fetch** and **Web Search** — give the model a URL and it reads the page as clean Markdown, or let it search the web and follow up on what it finds.

## ✨ Key Features

### 🔗 MCP Servers (Streamable HTTP)
Connect any Streamable HTTP MCP server and its tools become available to the model in every conversation.

- **Add by JSON**: Paste a standard `mcpServers` config in the **MCP Servers** panel:
  ```json
  {
    "mcpServers": {
      "my-server": {
        "url": "https://example.com/mcp",
        "headers": { "Authorization": "Bearer <token>" }
      }
    }
  }
  ```
- **Add by form**: Or fill in the URL and any static headers by hand — several servers can be pasted at once
- **Dual-era protocol**: Speaks the stateless `2026-07-28` protocol and falls back to the legacy `initialize` handshake (2025-11-25 and earlier) automatically; the negotiated version is shown on the server card
- **Server-side proxy**: All MCP traffic goes through Next.js API routes under `/api/mcp`, so there is no CORS to fight and your credentials only travel on the browser→server hop of your own instance
- **Per-tool control**: Enable or disable individual tools per server; the chat bar shows how many MCP tools the model can currently see
- **Auto and manual execution**: Turn Auto on to let the model run tools by itself, or leave it off and press **Call** on each tool card to review the arguments first
- **Progress and logs**: `notifications/progress` updates and server log messages are relayed into the tool card while a long call runs
- **Elicitation**: Servers that ask the user for input mid-call render a prompt in the chat — both `form` mode (a generated form from the requested schema) and `url` mode (an authorization link)
- **Rich results**: Structured content and image results are rendered, not flattened to text
- **Live tool lists**: `tools/list_changed` notifications refresh the tool list without reconnecting
- **Resources and prompts**: Browse what a server exposes and preview a resource or prompt straight from the panel
- **Safe naming**: An MCP tool whose name collides with a local tool is offered under a server-prefixed name, and every call is bound to the exact tool that was offered — see [How tool calls are resolved](#-how-tool-calls-are-resolved)
- **Limitations**: stdio servers are not supported (HTTP only), and OAuth is not implemented — static headers only

### 📚 Agent Skills
A skill is a folder of instructions the model loads only when a task calls for it, following the open
[Agent Skills specification](https://agentskills.io/specification).

- **The format**: a required `SKILL.md` with YAML frontmatter plus optional `references/`, `scripts/`, `assets/`:
  ```markdown
  ---
  name: pdf-processing
  description: Extract text, tables and metadata from PDFs. Use when the user uploads a PDF or asks about its contents.
  ---

  # PDF processing

  Read [references/REFERENCE.md](references/REFERENCE.md) for the details of each document class.
  ```
- **Three ways to import**: pick a skill folder (a folder holding several skill directories imports all of them), upload a `.zip`, or paste a single `SKILL.md`
- **Bundled sample**: the empty Skills panel offers a one-click import of the `pdf-processing` sample so you can try the whole flow immediately
- **Per-skill enable**: toggle each skill on or off; the chat bar shows how many skills are active
- **Progressive disclosure**: enabled skills appear in the system prompt as a name + description catalog only (~50-100 tokens each); the full instructions are pulled in on demand
- **Four built-in tools**, executed in the page against the local copy, never over the network:
  - `load_skill` — load a skill's full instructions and the list of files it ships
  - `read_skill_file` — read one bundled text file, paged for long references
  - `list_skill_files` — browse the skill's files with their sizes
  - `search_skill_files` — grep the skill's text files and get `path:line` matches
- **Explicit invocation**: type `/skill-name your request` to inject a skill directly — a `/` autocomplete lists the enabled skills, and the sent message shows a compact **Skill** chip instead of the injected block
- **In-app viewer**: browse the file tree, read Markdown rendered like chat content, follow relative links between a skill's files inside the viewer, edit any text file in place (editing `SKILL.md` re-validates it), and download the skill as a zip
- **Export and manage**: skills travel with the app-data export (text inline, binaries base64) and can be removed one by one or through the batch-delete dialog
- **Master switch**: the four tools are governed as one group by **Skill tools** in the **Built-in Tools** panel — turn it off and no tools, no skill catalog and no `/` autocomplete reach the model, whatever is enabled here
- **Limitation**: bundled scripts are **never executed** — the model reads them and reproduces the logic, or asks you to run them

### 🌐 Built-in Tools · Web Fetch and Web Search
A built-in tool that lets the model read a URL. The page is fetched **on the server**, so there is no
CORS wall, and it is reduced to the part worth spending tokens on before the model ever sees it.

- **Three modes**: `article` (default) keeps the main content only, `full` keeps the whole page for
  index and listing pages where the main content is the list, `raw` skips HTML conversion entirely.
  Article mode falls back to the full page on its own when it cannot find a real article.
- **Clean Markdown**: Mozilla Readability picks the content, [`@mdream/js`](https://www.npmjs.com/package/@mdream/js)
  emits the Markdown. An MDN reference page drops from 57k characters of HTML to 35k of Markdown; a blog
  post drops from 26k to 6k.
- **JSON and text pass through**: JSON is pretty-printed, `text/*` is returned as-is. Pages in GB18030,
  GBK or Big5 are decoded from the declared charset instead of being mangled as UTF-8.
- **Chunked reading**: long pages come back 20,000 characters at a time, and the result tells the model
  the `start_index` to ask for next. Chunks are served from a 15-minute cache, so continuing a page
  never re-fetches it.
- **Deploying on a public server?** Start it with `WEB_FETCH_BLOCK_PRIVATE=true`. The hostname is then
  resolved and loopback, private, link-local and cloud-metadata addresses are refused — on the initial
  URL and on every redirect hop. It is off by default because Agent Playground normally runs on your own
  machine; the Docker Compose file turns it on.
- **Off by default**: turn it on in the **Built-in Tools** panel — the same place that holds the master
  switch for the skill tools; a **Web fetch** badge then appears on the chat bar and the tool is offered in
  every conversation.

**Web Search** turns the playground into something that can answer questions about the present. It is backed by
[Tavily](https://app.tavily.com/home), a search API built for LLMs, and pairs with Web Fetch: search for the page,
then read it.

- **Your own key, your own quota**: paste a Tavily key in the **Built-in Tools** panel. The free tier gives 1,000
  credits a month with no card; a basic search costs 1 credit, an advanced one 2. The key is stored in this
  browser and passed straight through to Tavily — it is never written to a log or kept on the server.
- **What the model gets**: a short answer plus the top results as title, URL, snippet and, for the `news` topic,
  a published date. The tool description tells it to call `web_fetch` on a result URL when it needs the full page.
- **Parameters it can steer**: `max_results` (1-10), `topic` (general / news / finance), `time_range`
  (day / week / month / year), `search_depth` (basic or advanced) and `include_domains` to stay inside a site.
- **Repeat queries are free**: identical searches are answered from a 10-minute cache, so a model retrying itself
  in Auto mode does not burn your credits.
- **Off by default**, and offered only once a key is present.

### 🛠️ Advanced Tool System
- **Custom Tool Creation**: Build tools with JSON schema definitions
- **AI Tool Generator**: Generate tools automatically from natural language descriptions
- **HTTP Request Integration**: Configure tools to call external APIs
- **Manual Testing**: Test tools manually before agent integration
- **Tool Templates**: Quick-start templates for common tool patterns

### 🤖 Multi-Agent Development
- **Agent Management**: Create and configure multiple AI agents with custom instructions
- **Agent Templates**: Pre-built agent templates for common use cases
- **AI-Powered Generation**: Generate agent instructions using AI assistance
- **Multi-Language Support**: Generate instructions in user's preferred language

### 🔌 Multi-LLM Provider Support
- **OpenAI**: GPT-4.1, GPT-4o, GPT-o1 and other OpenAI models
- **Deepseek**: Deepseek-chat and reasoning models
- **Qwen**: Alibaba's Qwen model family
- **Doubao**: ByteDance's AI models
- **Qianfan**: Baidu's AI platform
- **XunfeiXinhuo**: iFlytek's AI models
- **OpenRouter / PPIO**: Aggregated access to many models via OpenAI-compatible APIs
- **Ollama**: Local model deployment
- **Custom Providers**: Any OpenAI-compatible API endpoint
- **Model Discovery**: Fetch the provider's model list via the `/models` API and pick the ones you want

### 💬 Interactive Chat Interface
- **Real-time Streaming**: Live response streaming from LLMs
- **Tool Call Execution**: Watch agents use tools in real-time
- **Token Usage Tracking**: Monitor API costs and usage statistics
- **Model Information**: Display provider and model info for each response
- **Message Management**: Edit, retry, and delete messages
- **Session Management**: Multiple chat sessions with auto-save

### 🔧 Developer-Friendly Features
- **Local Storage**: All data stored locally in browser (IndexedDB)
- **Import/Export**: Backup and share agents, tools and skills
- **Hot Reload**: Instant updates during development
- **Error Handling**: Comprehensive error messages and debugging info
- **Responsive Design**: Works on desktop and mobile devices

### 🐳 Docker Support
- **Easy Deployment**: Docker Compose for instant setup
- **Development & Production**: Separate configurations for different environments
- **Health Monitoring**: Built-in health checks

## 🚀 Quick Start

### Option 1: Run with npx (Recommended)

```bash
npx agent-playground
```

This command will automatically download and start Agent Playground on your local machine at `http://localhost:3001`.

### Option 2: Docker

```bash
# Clone the repository
git clone https://github.com/coldstone/agent-playground.git
cd agent-playground

# Start with Docker Compose
docker-compose up -d
```

Open `http://localhost:3001` in your browser. That's it! 🎉

### Docker Commands

```bash
# Development mode (with hot reload)
docker-compose -f docker-compose.dev.yml up

# Production mode
docker-compose build
docker-compose up

# Test Docker configuration
./scripts/test-docker.sh

# Stop services
docker-compose down
```

### Option 3: Global Installation

```bash
npm install -g agent-playground
agent-playground
```



### Option 4: Local Development

```bash
git clone https://github.com/coldstone/agent-playground.git
cd agent-playground
npm install
npm run dev
```

## 📦 Installation Requirements

### For npm/npx installation:
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

### For Docker installation:
- **Docker**: Version 20.0.0 or higher
- **Docker Compose**: Version 2.0.0 or higher (optional, for easier management)
- **Modern Browser**: Chrome, Firefox, Safari, or Edge

## 🔧 Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/coldstone/agent-playground.git
cd agent-playground
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

The application will start at `http://localhost:3001`.

### 4. Build for Production
```bash
npm run build
```

### 5. Start Production Server
```bash
npm start
```

## 📖 Usage Guide

### 1. Configure LLM Provider
1. Open the **LLM Configuration** panel on the right
2. Select your preferred provider (OpenAI, Deepseek, etc.)
3. Enter your API endpoint and API key
4. Choose a model from the dropdown
5. Test the connection

### 2. Create Your First Agent
1. Click the **Agents** button in the top toolbar
2. Click **New Agent** to create an agent
3. Fill in the agent name and description
4. Use **AI Generate** to create instructions automatically
5. Assign tools to your agent (optional)
6. Save the agent

### 3. Build Custom Tools
1. Click the **Tools** button in the top toolbar
2. Use **AI Generate** to create tools from descriptions
3. Or click **Custom** to manually define tool schemas
4. Configure HTTP requests for API integration
5. Test tools manually before assigning to agents

### 4. Start Debugging
1. Select an agent from the welcome page
2. Start a conversation to test agent behavior
3. Watch tool calls execute in real-time
4. Monitor token usage and API costs
5. Iterate and improve your agent configuration

### 5. Connect an MCP Server
1. Open the **MCP Servers** panel on the right and click **+**
2. Paste an `mcpServers` JSON config, or enter the server URL and any auth headers
3. The server connects immediately; expand its card to see the negotiated protocol, tools, resources and prompts
4. Switch individual tools off if you only want part of the server, and use the card toggle to take the whole server offline
5. Start a conversation — the chat bar shows the MCP tool count, and calls appear as cards you can run manually or let Auto mode execute

### 6. Add a Skill
1. Open the **Skills** panel and click **+** (or **Import sample skill** on the empty state)
2. Import a skill folder, a `.zip`, or paste a `SKILL.md`
3. Warnings from lenient validation are shown on the card — a missing `description` is the only fatal one
4. Keep the skill enabled so its name and description reach the model's catalog
5. Ask a question the skill's description matches, and watch the model call `load_skill` and then read the files it needs
6. Or invoke it yourself: type `/` in the chat box, pick the skill and add your request

### 7. Enable Web Fetch
1. Open the **Built-in Tools** panel on the right and switch **Web Fetch** on
2. The chat bar shows a **Web fetch** badge, and `web_fetch` is offered in every conversation
3. Paste a URL and ask for a summary — the tool call card shows the URL being read
4. If the model needs the rest of a long page it calls `web_fetch` again with `start_index`
5. Running this on a public server? Start it with `WEB_FETCH_BLOCK_PRIVATE=true` so the model cannot
   reach localhost, your LAN or the cloud metadata endpoint

### 8. Enable Web Search
1. Get a free key at [app.tavily.com/home](https://app.tavily.com/home) (1,000 credits a month, no card)
2. Open the **Built-in Tools** panel, switch **Web Search** on and paste the key — the eye button reveals it
3. Until a key is present the tool is not offered, and the panel says so
4. A **Web search** badge appears on the chat bar; ask something current and the model searches, then usually
   calls `web_fetch` on the result it wants to read in full

## 🧭 How Tool Calls Are Resolved
Local tools, MCP tools and built-in skill tools share one function namespace, so two of them can end up
with the same name. Agent Playground binds every tool call to a concrete tool **at the moment the model
makes it**, resolved only against the tools that were sent in that request, and executes it through that
binding — a local tool can never run in place of the MCP tool the model actually called. Colliding MCP
tools are additionally offered under a server-prefixed name, so the model never sees two tools with one
name.

## 🏗️ Building and Deployment

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
```



### Linting
```bash
npm run lint
```

### Type Checking
```bash
npx tsc --noEmit
```



## 📁 Project Structure

```
agent-playground/
├── public/                  # Static assets, icons and the bundled sample skill
├── src/
│   ├── app/                 # Next.js app directory
│   │   ├── api/             # API routes
│   │   │   └── mcp/         # MCP proxy routes (connect, tools, resources, prompts, elicitation)
│   │   ├── debug/           # Debug pages
│   │   └── markdown-test/   # Markdown testing page
│   ├── components/          # React components
│   │   ├── agents/          # Agent management components
│   │   ├── chat/            # Chat interface components
│   │   ├── config/          # Configuration components
│   │   ├── layout/          # Layout components
│   │   ├── markdown/        # Markdown rendering components
│   │   ├── modals/          # Modal dialog components
│   │   ├── tools/           # Tool management components
│   │   └── ui/              # Reusable UI components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility libraries and services
│   │   ├── clients/         # API client implementations
│   │   ├── generators/      # AI-powered generators
│   │   ├── mcp/             # MCP client and Streamable HTTP transport
│   │   ├── skills/          # Agent Skills: parsing, import/export, prompt, built-in tools
│   │   └── storage/         # Data persistence layer
│   ├── styles/              # CSS and styling files
│   └── types/               # TypeScript type definitions
├── bin/                     # Executable scripts
└── scripts/                 # Build and deployment scripts
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy Agent Building!** 🚀
