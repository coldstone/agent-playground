/**
 * URL validation for the built-in web_fetch tool.
 *
 * Protocol and URL-shape checks always run. The private-network check is **opt-in**: it only runs
 * when WEB_FETCH_BLOCK_PRIVATE=true. Agent Playground normally runs on the user's own machine,
 * where reaching localhost is not a privilege the model did not already have through the user,
 * and a default-on check breaks every fetch behind a fake-ip proxy (Clash/Surge), which resolves
 * every domain to a synthetic private address. docker-compose.yml sets the variable, because a
 * container is the deployment that can end up on a real server.
 *
 * Turn it on for any public deployment. When it is on, the hostname is resolved and inspected
 * rather than trusted, on the initial URL *and* on every redirect hop, since a public host can
 * redirect to 127.0.0.1 — and the URL web_fetch receives comes from the model, which can be
 * steered by the content of a page it just read.
 */
import { lookup } from 'dns'

export interface GuardResult {
  ok: boolean
  /** Human readable reason, present when ok is false. */
  reason?: string
}

const ALLOWED_PROTOCOLS: Record<string, boolean> = { 'http:': true, 'https:': true }

export function blockPrivateAddresses(): boolean {
  return String(process.env.WEB_FETCH_BLOCK_PRIVATE || '').toLowerCase() === 'true'
}

/** Hostnames that always resolve to the local machine, regardless of what DNS says. */
function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return host === 'localhost' || /\.localhost$/.test(host)
}

/** True for IPv4 literals inside a range that must never be fetched. */
export function isPrivateIPv4(address: string): boolean {
  const parts = address.split('.')
  if (parts.length !== 4) return false

  const octets: number[] = []
  for (let i = 0; i < parts.length; i++) {
    const value = parseInt(parts[i], 10)
    if (!isFinite(value) || value < 0 || value > 255) return false
    octets.push(value)
  }

  const [a, b] = octets

  if (a === 0) return true // 0.0.0.0/8 "this network"
  if (a === 10) return true // private
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, covers 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true // private
  if (a === 192 && b === 168) return true // private
  if (a === 192 && b === 0) return true // IETF protocol assignments / 192.0.0.0/24
  if (a === 100 && b >= 64 && b <= 127) return true // carrier-grade NAT
  if (a >= 224) return true // multicast and reserved, includes 255.255.255.255

  return false
}

/** True for IPv6 literals inside a range that must never be fetched. */
export function isPrivateIPv6(address: string): boolean {
  const host = address.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').split('%')[0]

  if (host === '::' || host === '::1') return true
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true // unique local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(host)) return true // link-local fe80::/10
  if (/^ff[0-9a-f]{2}:/.test(host)) return true // multicast

  // IPv4-mapped and IPv4-compatible addresses (::ffff:127.0.0.1) tunnel the v4 ranges through v6.
  const mapped = /^::(?:ffff:(?:0{1,4}:)?)?(\d+\.\d+\.\d+\.\d+)$/.exec(host)
  if (mapped) return isPrivateIPv4(mapped[1])

  return false
}

export function isPrivateAddress(address: string, family?: number): boolean {
  if (family === 6 || address.indexOf(':') >= 0) return isPrivateIPv6(address)
  return isPrivateIPv4(address)
}

/** Resolve a hostname to every address it maps to. Rejects on DNS failure. */
function resolveAll(hostname: string): Promise<{ address: string; family: number }[]> {
  return new Promise((resolve, reject) => {
    lookup(hostname, { all: true }, (err, addresses) => {
      if (err) reject(err)
      else resolve(addresses as { address: string; family: number }[])
    })
  })
}

/**
 * Check one URL (initial or redirect target). Returns a reason instead of throwing so the caller
 * can turn it into a tool error the model can read.
 */
export async function guardUrl(rawUrl: string): Promise<GuardResult> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'Not a valid absolute URL.' }
  }

  if (!ALLOWED_PROTOCOLS[parsed.protocol]) {
    return { ok: false, reason: 'Only http and https URLs can be fetched (got "' + parsed.protocol + '").' }
  }

  if (!parsed.hostname) {
    return { ok: false, reason: 'The URL has no host.' }
  }

  if (!blockPrivateAddresses()) return { ok: true }

  if (isLocalHostname(parsed.hostname)) {
    return { ok: false, reason: 'Refusing to fetch a local address (' + parsed.hostname + ').' }
  }

  // A bare IP literal never reaches DNS, so check it directly first.
  const literal = parsed.hostname.replace(/^\[/, '').replace(/\]$/, '')
  const isIPv4Literal = /^\d+\.\d+\.\d+\.\d+$/.test(literal)
  const isIPv6Literal = literal.indexOf(':') >= 0
  if (isIPv4Literal || isIPv6Literal) {
    if (isPrivateAddress(literal)) {
      return { ok: false, reason: 'Refusing to fetch a private or loopback address (' + literal + ').' }
    }
    return { ok: true }
  }

  let addresses: { address: string; family: number }[]
  try {
    addresses = await resolveAll(parsed.hostname)
  } catch {
    return { ok: false, reason: 'Could not resolve the host "' + parsed.hostname + '".' }
  }

  if (addresses.length === 0) {
    return { ok: false, reason: 'Could not resolve the host "' + parsed.hostname + '".' }
  }

  // Every address must be public: a name that resolves to both a public and a private address is
  // still a way into the LAN, since we do not control which one the socket picks.
  const blocked = addresses.filter((entry) => isPrivateAddress(entry.address, entry.family))[0]
  if (blocked) {
    return {
      ok: false,
      reason:
        'Refusing to fetch "' + parsed.hostname + '": it resolves to a private or loopback address (' +
        blocked.address + ').'
    }
  }

  return { ok: true }
}
