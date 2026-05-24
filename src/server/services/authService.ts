/**
 * Authentication service.
 *
 * Provides helpers for:
 *  - Hashing and verifying passwords (bcryptjs)
 *  - Signing and verifying JWT access / refresh tokens
 *  - Refresh-token lifecycle (issue, validate, rotate, revoke)
 */
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES,
  JWT_REFRESH_EXPIRES,
} from '../config'
import { query, queryOne } from '../db/postgres'
import type { CloudRole } from '../../shared/types'

const BCRYPT_ROUNDS = 12

// ── Password helpers ──────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub:      string          // staffId
  clinicId: string
  branchId: string | null
  role:     CloudRole
}

/**
 * Sign a short-lived access token (default 15 min).
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  })
}

/**
 * Sign a long-lived refresh token (default 30 days).
 * The `jti` (JWT ID) is stored in the database so it can be revoked.
 */
export function signRefreshToken(staffId: string, jti: string): string {
  return jwt.sign({ sub: staffId, jti }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  })
}

export interface RefreshTokenPayload {
  sub: string   // staffId
  jti: string   // token ID — must be validated against DB
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload
}

// ── Refresh-token persistence ─────────────────────────────────────────────────

interface RefreshTokenRow {
  id:         string
  staff_id:   string
  clinic_id:  string
  token_hash: string
  expires_at: Date
  revoked:    boolean
}

/**
 * Store a new refresh token in the database.
 * We store a SHA-256 hash of the token, not the token itself.
 */
export async function storeRefreshToken(
  staffId:   string,
  clinicId:  string,
  jti:       string,
  expiresAt: Date,
): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (id, staff_id, clinic_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), staffId, clinicId, jti, expiresAt],
  )
}

/**
 * Validate a refresh token's `jti` against the database.
 * Returns the row if valid and not revoked, null otherwise.
 */
export async function findValidRefreshToken(
  jti: string,
): Promise<RefreshTokenRow | null> {
  return queryOne<RefreshTokenRow>(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked    = false
       AND expires_at > now()`,
    [jti],
  )
}

/**
 * Revoke a single refresh token by its jti.
 * Called on logout or token rotation.
 */
export async function revokeRefreshToken(jti: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
    [jti],
  )
}

/**
 * Revoke all refresh tokens for a staff member (e.g. password change, account lock).
 */
export async function revokeAllTokensForStaff(staffId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE staff_id = $1`,
    [staffId],
  )
}

// ── Token pair generation ─────────────────────────────────────────────────────

export interface TokenPair {
  accessToken:  string
  refreshToken: string
  expiresIn:    number   // access token TTL in seconds (for client-side scheduling)
}

/**
 * Issue a fresh access + refresh token pair and persist the refresh token.
 */
export async function issueTokenPair(
  staffId:  string,
  clinicId: string,
  branchId: string | null,
  role:     CloudRole,
): Promise<TokenPair> {
  const jti = randomUUID()

  // Calculate refresh expiry in milliseconds
  const refreshMs = parseExpiry(JWT_REFRESH_EXPIRES)
  const expiresAt = new Date(Date.now() + refreshMs)

  const accessToken  = signAccessToken({ sub: staffId, clinicId, branchId, role })
  const refreshToken = signRefreshToken(staffId, jti)

  await storeRefreshToken(staffId, clinicId, jti, expiresAt)

  // Return access-token TTL in seconds for the client
  const expiresIn = Math.floor(parseExpiry(JWT_ACCESS_EXPIRES) / 1000)

  return { accessToken, refreshToken, expiresIn }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Parse a JWT expiry string like '15m', '30d', '2h' into milliseconds.
 */
function parseExpiry(expiry: string): number {
  const unit  = expiry.slice(-1)
  const value = parseInt(expiry.slice(0, -1), 10)
  switch (unit) {
    case 's': return value * 1_000
    case 'm': return value * 60_000
    case 'h': return value * 3_600_000
    case 'd': return value * 86_400_000
    default:  return 900_000  // fallback 15 min
  }
}
