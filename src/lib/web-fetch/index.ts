// Browser-safe web_fetch helpers: the tool definition, its settings and in-page execution.
// The server pipeline lives in ./server and is imported only from src/app/api/fetch/route.ts.
export * from './tool'
export * from './execute'
// Settings moved to src/lib/builtin-tools once they governed more than web fetch. Re-exported
// here so existing imports keep resolving.
export * from '../builtin-tools/settings'
