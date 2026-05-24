/**
 * Server entry point.
 *
 * Runs DB migrations, then starts the Express server.
 * Start with:
 *   npx ts-node src/server/index.ts
 * Or via the npm script:
 *   npm run server
 */
import { createApp }       from './app'
import { PORT, NODE_ENV }  from './config'
import { runPgMigrations } from './db/pgSchema'
import { pool }            from './db/postgres'

async function main(): Promise<void> {
  // Verify DB connectivity before doing anything else
  try {
    await pool.query('SELECT 1')
    console.log('[DB] Connected to PostgreSQL')
  } catch (err) {
    console.error('[DB] Failed to connect:', err)
    process.exit(1)
  }

  // Run any pending schema migrations
  try {
    await runPgMigrations()
    console.log('[DB] Migrations up to date')
  } catch (err) {
    console.error('[DB] Migration failed:', err)
    process.exit(1)
  }

  const app    = createApp()
  const server = app.listen(PORT, () => {
    console.log(`[SERVER] Vorsa Cloud API running on http://localhost:${PORT} (${NODE_ENV})`)
  })

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[SERVER] ${signal} received — shutting down gracefully`)
    server.close(async () => {
      await pool.end()
      console.log('[SERVER] Closed')
      process.exit(0)
    })
    // Force exit after 10 s if connections don't drain
    setTimeout(() => {
      console.error('[SERVER] Forceful exit after timeout')
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT',  () => void shutdown('SIGINT'))
}

void main()
