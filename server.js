// Custom server — needed to raise the HTTP keep-alive timeout above the
// reverse proxy's (Cloudflare Tunnel default origin keepAliveTimeout is 90s).
// `next start` uses Node's default http.Server keepAliveTimeout of 5s, which
// causes the proxy to reuse connections Node has already silently closed,
// surfacing as intermittent 502s on the client.
const { createServer } = require('http')
const next = require('next')

// npm start runs this directly (bypassing `next start`, which sets this itself)
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res))

  // Must stay above the proxy's origin keep-alive timeout (Cloudflare Tunnel: 90s),
  // and headersTimeout must stay above keepAliveTimeout (Node requirement).
  server.keepAliveTimeout = 100_000
  server.headersTimeout = 105_000

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
