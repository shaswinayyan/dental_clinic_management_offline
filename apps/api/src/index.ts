/**
 * VORSA API — Hono server entry point.
 *
 * Starts the Node.js HTTP server. The Hono app is created in app.ts;
 * this file is only responsible for the listen() call and graceful shutdown.
 */
import { serve } from '@hono/node-server'
import { env }   from './env'
import { app }   from './app'

const server = serve(
  { fetch: app.fetch, port: env.PORT },
  (info) => {
    console.log(`🦷 VORSA API running on http://localhost:${info.port}`)
    console.log(`   mode: ${env.NODE_ENV}`)
  },
)

// ── Graceful shutdown ──────────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  console.log(`\n${signal} received — shutting down gracefully`)
  server.close(() => {
    console.log('HTTP server closed')
    process.exit(0)
  })
  setTimeout(() => {
    console.error('Forced shutdown after 10s')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
