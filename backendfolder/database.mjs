import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import pg from 'pg'

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL
const SCHEMA = await readFile(new URL('../data/schema.sql', import.meta.url), 'utf8')

export const databaseConfigured = Boolean(DATABASE_URL)
export const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: true },
    })
  : null

let databaseReady = false
let schemaInitialization

export const ensureDatabase = async () => {
  if (!pool) return false
  if (databaseReady) return true
  if (!schemaInitialization) {
    schemaInitialization = (async () => {
      await pool.query('SELECT 1')
      await pool.query(SCHEMA)
      databaseReady = true
      console.info('PostgreSQL connection established; schema is ready.')
    })().catch((error) => {
      databaseReady = false
      const code = typeof error?.code === 'string' ? ` (code ${error.code})` : ''
      console.error(`PostgreSQL connection or schema initialization failed${code}. Check DATABASE_URL and Supabase network settings.`)
      throw error
    }).finally(() => {
      schemaInitialization = undefined
    })
  }
  try {
    await schemaInitialization
    return true
  } catch {
    return false
  }
}
