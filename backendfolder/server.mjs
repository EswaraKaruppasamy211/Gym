import 'dotenv/config'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import express from 'express'
import { databaseConfigured, ensureDatabase, pool } from './database.mjs'
const PORT = Number.parseInt(process.env.PORT ?? '3001', 10)
const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DIST = path.join(ROOT, 'dist')

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

const scrypt = (password, salt) => new Promise((resolve, reject) => {
  scryptCallback(password, salt, 64, (error, derivedKey) => {
    if (error) reject(error)
    else resolve(derivedKey)
  })
})

const hashPassword = async (password) => {
  const salt = randomBytes(16).toString('hex')
  const digest = await scrypt(password, salt)
  return `${salt}:${digest.toString('hex')}`
}

const verifyPassword = async (password, storedHash) => {
  if (typeof storedHash !== 'string') return false
  const [salt, digestHex] = storedHash.split(':')
  if (!salt || !digestHex || !/^[0-9a-f]{128}$/i.test(digestHex)) return false
  const actual = await scrypt(password, salt)
  const expected = Buffer.from(digestHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const digestToken = (token) => createHash('sha256').update(token).digest('hex')
const sanitizeProfile = (profile) => {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {}
  const { password: _password, ...safeProfile } = profile
  return safeProfile
}

const normalizeAccount = (body) => {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { error: 'Enter a valid email address.' }
  }
  if (!password || password.length > 1024) return { error: 'Enter a valid password.' }
  return { email, password }
}

const requireDatabase = async (_request, response, next) => {
  if (await ensureDatabase()) return next()
  return response.status(503).json({ error: 'PostgreSQL persistence is temporarily unavailable.' })
}

const createSession = async (userId) => {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = digestToken(token)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await pool.query(
    'INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash, userId, expiresAt],
  )
  return token
}

const createAccount = async (client, email, password) => {
  const passwordHash = await hashPassword(password)
  const result = await client.query(
    'INSERT INTO app_users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, passwordHash],
  )
  return result.rows[0].id
}

const persistUserData = async (client, userId, data = {}) => {
  const profile = sanitizeProfile(data.profile)
  const workout = data.workout && typeof data.workout === 'object' ? data.workout : null
  const messages = Array.isArray(data.messages) ? data.messages : []
  const history = Array.isArray(data.history) ? data.history : []

  await client.query(
    `INSERT INTO user_profiles (user_id, profile, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = NOW()`,
    [userId, JSON.stringify(profile)],
  )
  await client.query(
    `INSERT INTO user_app_state (user_id, active_workout, messages, updated_at)
     VALUES ($1, $2::jsonb, $3::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       active_workout = EXCLUDED.active_workout,
       messages = EXCLUDED.messages,
       updated_at = NOW()`,
    [userId, JSON.stringify(workout), JSON.stringify(messages)],
  )
  for (const item of history) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) continue
    const dateValue = new Date(item.date)
    const occurredAt = Number.isNaN(dateValue.getTime()) ? new Date() : dateValue
    await client.query(
      `INSERT INTO workout_history (user_id, workout_id, occurred_at, completed, workout_data, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (user_id, workout_id) DO UPDATE SET
         occurred_at = EXCLUDED.occurred_at,
         completed = EXCLUDED.completed,
         workout_data = EXCLUDED.workout_data,
         updated_at = NOW()`,
      [userId, item.id, occurredAt, Boolean(item.completed), JSON.stringify(item)],
    )
  }
}

const readUserData = async (userId) => {
  const [profileResult, stateResult, historyResult] = await Promise.all([
    pool.query('SELECT profile FROM user_profiles WHERE user_id = $1', [userId]),
    pool.query('SELECT active_workout, messages FROM user_app_state WHERE user_id = $1', [userId]),
    pool.query(
      'SELECT workout_data FROM workout_history WHERE user_id = $1 ORDER BY occurred_at DESC',
      [userId],
    ),
  ])
  const state = stateResult.rows[0]
  return {
    profile: profileResult.rows[0]?.profile ?? {},
    workout: state?.active_workout ?? null,
    messages: state?.messages ?? [],
    history: historyResult.rows.map((row) => row.workout_data),
  }
}

const authenticate = async (request, response, next) => {
  const match = request.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32,})$/)
  if (!match) return response.status(401).json({ error: 'Authentication is required.' })
  const result = await pool.query(
    `SELECT app_users.id, app_users.email
     FROM user_sessions
     JOIN app_users ON app_users.id = user_sessions.user_id
     WHERE user_sessions.token_hash = $1 AND user_sessions.expires_at > NOW()`,
    [digestToken(match[1])],
  )
  if (!result.rowCount) return response.status(401).json({ error: 'Your session has expired.' })
  request.user = result.rows[0]
  request.sessionTokenHash = digestToken(match[1])
  return next()
}

app.get('/api/health', async (_request, response) => {
  const connected = await ensureDatabase()
  response.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'unavailable',
    database: connected ? 'connected' : 'unavailable',
    configured: databaseConfigured,
  })
})

app.post('/api/auth/register', requireDatabase, async (request, response) => {
  const account = normalizeAccount(request.body)
  if (account.error) return response.status(400).json({ error: account.error })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const userId = await createAccount(client, account.email, account.password)
    await persistUserData(client, userId, { profile: request.body.profile })
    await client.query('COMMIT')
    const token = await createSession(userId)
    return response.status(201).json({ token, email: account.email })
  } catch (error) {
    await client.query('ROLLBACK')
    if (error?.code === '23505') return response.status(409).json({ error: 'An account with this email already exists.' })
    console.error('PostgreSQL account registration failed.')
    return response.status(500).json({ error: 'The account could not be saved.' })
  } finally {
    client.release()
  }
})

app.post('/api/auth/login', requireDatabase, async (request, response) => {
  const account = normalizeAccount(request.body)
  if (account.error) return response.status(400).json({ error: account.error })
  const result = await pool.query('SELECT id, password_hash FROM app_users WHERE email = $1', [account.email])
  if (!result.rowCount || !await verifyPassword(account.password, result.rows[0].password_hash)) {
    return response.status(401).json({ error: 'Email or password is incorrect.' })
  }
  const token = await createSession(result.rows[0].id)
  return response.json({ token, email: account.email })
})

app.post('/api/auth/migrate', requireDatabase, async (request, response) => {
  const account = normalizeAccount(request.body)
  if (account.error) return response.status(400).json({ error: account.error })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query(
      'SELECT id, password_hash FROM app_users WHERE email = $1 FOR UPDATE',
      [account.email],
    )
    let userId
    if (existing.rowCount) {
      if (!await verifyPassword(account.password, existing.rows[0].password_hash)) {
        await client.query('ROLLBACK')
        return response.status(401).json({ error: 'The cloud account password does not match.' })
      }
      userId = existing.rows[0].id
    } else {
      userId = await createAccount(client, account.email, account.password)
    }
    await persistUserData(client, userId, request.body.data)
    await client.query('COMMIT')
    const token = await createSession(userId)
    return response.json({ token, email: account.email })
  } catch {
    await client.query('ROLLBACK')
    console.error('Legacy account migration failed.')
    return response.status(500).json({ error: 'The existing account data could not be synchronized.' })
  } finally {
    client.release()
  }
})

app.get('/api/me/data', requireDatabase, authenticate, async (request, response) => {
  return response.json(await readUserData(request.user.id))
})

app.put('/api/me/data', requireDatabase, authenticate, async (request, response) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await persistUserData(client, request.user.id, request.body)
    await client.query('COMMIT')
    return response.json({ saved: true })
  } catch {
    await client.query('ROLLBACK')
    console.error('PostgreSQL user data save failed.')
    return response.status(500).json({ error: 'Your data could not be saved.' })
  } finally {
    client.release()
  }
})

app.post('/api/auth/logout', requireDatabase, authenticate, async (request, response) => {
  await pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [request.sessionTokenHash])
  return response.json({ loggedOut: true })
})

app.use('/api', (error, _request, response, _next) => {
  const code = typeof error?.code === 'string' ? ` (code ${error.code})` : ''
  console.error(`Flexora API request failed${code}.`)
  if (!response.headersSent) {
    response.status(500).json({ error: 'The API request could not be completed.' })
  }
})

app.use('/api', (_request, response) => response.status(404).json({ error: 'API route not found.' }))
app.use(express.static(DIST))
app.use((request, response, next) => {
  if (request.method !== 'GET') return next()
  return response.sendFile(path.join(DIST, 'index.html'), (error) => {
    if (error) next()
  })
})

const server = createServer(app)
server.listen(PORT, () => {
  console.info(`Flexora API listening on port ${PORT}.`)
  if (!databaseConfigured) {
    console.warn('DATABASE_URL is not set; PostgreSQL endpoints will return unavailable and browser storage remains active.')
  } else {
    void ensureDatabase()
  }
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      void pool?.end().finally(() => process.exit(0))
    })
  })
}
