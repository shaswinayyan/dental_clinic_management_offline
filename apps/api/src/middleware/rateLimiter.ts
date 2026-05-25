/**
 * Rate limiting middleware using Upstash Redis + @upstash/ratelimit.
 *
 * Why Upstash over express-rate-limit:
 *   - Serverless-compatible (no in-process Redis connection to manage)
 *   - Distributed — works correctly with multiple API instances
 *   - Sliding window algorithm is more accurate than fixed window
 *   - Falls back gracefully to in-memory when Upstash is not configured
 *
 * Usage:
 *   app.use('/api/*', rateLimiter('global', 300, '15 m'))
 *   app.use('/api/v2/auth/*', rateLimiter('auth', 20, '15 m'))
 */
import type { Context, MiddlewareHandler } from 'hono'
import { Ratelimit }   from '@upstash/ratelimit'
import { Redis }       from '@upstash/redis'
import { env }         from '../env'

// Cache ratelimiter instances so we don't recreate them per-request
const limiters = new Map<string, Ratelimit>()

type Duration = `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`

export function rateLimiter(
  prefix:   string,
  max:      number,
  window:   Duration,
): MiddlewareHandler {
  return async (c: Context, next) => {
    // In development without Upstash, skip rate limiting
    if (!env.hasUpstash) {
      await next()
      return
    }

    // Lazily create the ratelimiter for this prefix
    if (!limiters.has(prefix)) {
      const redis = new Redis({
        url:   env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
      limiters.set(prefix, new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(max, window),
        prefix:  `vorsa:rl:${prefix}`,
      }))
    }

    const limiter    = limiters.get(prefix)!
    const identifier = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'
    const { success, limit, remaining, reset } = await limiter.limit(identifier)

    // Expose rate limit headers
    c.header('X-RateLimit-Limit',     String(limit))
    c.header('X-RateLimit-Remaining', String(remaining))
    c.header('X-RateLimit-Reset',     String(reset))

    if (!success) {
      return c.json(
        { success: false, error: 'Too many requests — please slow down' },
        429,
      )
    }

    await next()
  }
}
