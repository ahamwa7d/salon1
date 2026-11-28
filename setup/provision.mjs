/*
 * Seller-side provisioning for a new white-label client.
 *
 * This file is NOT part of the deployed website. It uses the Supabase
 * Management API with a Personal Access Token that stays on the seller's
 * machine, creates a dedicated project per client, applies schema.sql
 * and materialises a ready-to-upload site folder:
 *
 *   clients/<slug>/site/   <- upload this to the client's hosting
 *   clients/<slug>/client.json
 *
 * The token, database password and service-role key are never written to disk;
 * they are printed once so the seller can store them in a password manager.
 */
import { mkdir, writeFile, readFile, cp, stat, rm } from 'node:fs/promises'
import path from 'node:path'

export const API_BASE = 'https://api.supabase.com'
export const DEFAULT_REGION = 'ap-southeast-1'

const DEPLOY_FILES = [
  'index.html',
  'admin.html',
  'privacy.html',
  'terms.html',
  'usage-policy.html',
  'manifest.webmanifest',
  'sw.js',
  'robots.txt',
  '.htaccess'
]
const DEPLOY_DIRS = ['css', 'js', 'img']

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'client'
}

async function readBody(res) {
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) } catch (_e) { return text }
}

function errorMessage(data) {
  if (data == null) return 'no response body'
  if (typeof data === 'string') return data.slice(0, 300)
  return data.message || data.error || data.msg || JSON.stringify(data).slice(0, 300)
}

/** Authenticated call to the Supabase Management API. */
export async function managementApi(fetchImpl, token, route, init) {
  const options = Object.assign({}, init)
  options.headers = Object.assign(
    {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    init && init.headers
  )
  const res = await fetchImpl(API_BASE + route, options)
  const data = await readBody(res)
  if (!res.ok) {
    throw new Error('Management API ' + (options.method || 'GET') + ' ' + route + ' failed (' + res.status + '): ' + errorMessage(data))
  }
  return data
}

export async function listOrganizations({ token, fetchImpl = fetch }) {
  const data = await managementApi(fetchImpl, token, '/v1/organizations')
  return Array.isArray(data) ? data : []
}

export async function listRegions({ token, fetchImpl = fetch }) {
  try {
    const data = await managementApi(fetchImpl, token, '/v1/projects/available-regions')
    const regions = (data && (data.regions || data)) || []
    if (Array.isArray(regions) && regions.length) {
      return regions.map((r) => (typeof r === 'string' ? { id: r, name: r } : { id: r.id || r.slug || r.name, name: r.name || r.id }))
    }
  } catch (_e) { /* optional endpoint */ }
  return [
    { id: 'ap-southeast-1', name: 'Southeast Asia (Singapore)' },
    { id: 'me-central-1', name: 'Middle East (UAE)' },
    { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
    { id: 'us-east-1', name: 'US East (N. Virginia)' }
  ]
}

export async function createProject({ token, organizationId, name, region, dbPass, fetchImpl = fetch }) {
  const created = await managementApi(fetchImpl, token, '/v1/projects', {
    method: 'POST',
    body: JSON.stringify({
      name,
      organization_id: organizationId,
      region,
      db_pass: dbPass
    })
  })
  if (!created || !created.ref) {
    throw new Error('Management API did not return a project ref: ' + JSON.stringify(created).slice(0, 300))
  }
  return created
}

export async function getProject({ token, ref, fetchImpl = fetch }) {
  return managementApi(fetchImpl, token, '/v1/projects/' + ref)
}

/**
 * Projects are created asynchronously, so poll until Postgres is healthy.
 * `sleep` is injectable for tests.
 */
export async function waitForProject({
  token,
  ref,
  fetchImpl = fetch,
  timeoutMs = 15 * 60 * 1000,
  intervalMs = 5000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {}
}) {
  const started = Date.now()
  let last = 'UNKNOWN'
  while (Date.now() - started < timeoutMs) {
    const project = await getProject({ token, ref, fetchImpl })
    last = (project && project.status) || 'UNKNOWN'
    if (last === 'ACTIVE_HEALTHY') return project
    if (['INACTIVE', 'PAUSE_FAILED', 'RESTORE_FAILED', 'REMOVED'].includes(last)) {
      throw new Error('Project provisioning stopped with status ' + last)
    }
    log('   … project status: ' + last)
    await sleep(intervalMs)
  }
  throw new Error('Timed out waiting for the project (last status: ' + last + ')')
}

/** Run SQL through the Management API (used for schema.sql). */
export async function runSql({ token, ref, sql, fetchImpl = fetch }) {
  return managementApi(fetchImpl, token, '/v1/projects/' + ref + '/database/query', {
    method: 'POST',
    body: JSON.stringify({ query: sql })
  })
}

function keyValue(row) {
  if (!row) return ''
  return String(row.api_key || row.value || row.key || row.secret || '')
}

/** Return the project's anon and service_role keys, tolerating API shapes. */
export async function getProjectKeys({ token, ref, fetchImpl = fetch }) {
  const load = (query) => managementApi(fetchImpl, token, '/v1/projects/' + ref + '/api-keys' + query)
  let data = await load('')
  const rowsOf = (payload) => (Array.isArray(payload) ? payload : (payload && payload.keys) || [])
  const pick = (list) => {
    const byName = {}
    list.forEach((row) => {
      const name = String((row && (row.name || row.type)) || '').toLowerCase()
      byName[name] = row
    })
    return {
      anon: keyValue(byName.anon) || keyValue(byName.publishable) || keyValue(byName['anon key']),
      service: keyValue(byName.service_role) || keyValue(byName.secret) || keyValue(byName['service_role key'])
    }
  }
  let keys = pick(rowsOf(data))
  if (!keys.anon || !keys.service) {
    // Some API versions mask values unless the request explicitly reveals them.
    data = await load('?reveal=true')
    keys = pick(rowsOf(data))
  }
  if (!keys.anon) throw new Error('Could not read the anon key from the Management API response')
  return { anon: keys.anon, service: keys.service, raw: rowsOf(data) }
}

export async function createAdminUser({ projectUrl, serviceKey, email, password, fetchImpl = fetch }) {
  const res = await fetchImpl(projectUrl.replace(/\/+$/, '') + '/auth/v1/admin/users', {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: 'Bearer ' + serviceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, email_confirm: true })
  })
  const data = await readBody(res)
  if (!res.ok) throw new Error('Auth admin user failed (' + res.status + '): ' + errorMessage(data))
  return data
}

/** Optional hardening: close public sign-ups and set the production URL. */
export async function configureAuth({ token, ref, siteUrl, fetchImpl = fetch }) {
  const body = { disable_signup: true }
  if (siteUrl) body.site_url = siteUrl
  return managementApi(fetchImpl, token, '/v1/projects/' + ref + '/config/auth', {
    method: 'PATCH',
    body: JSON.stringify(body)
  })
}

export function configSource({ url, anonKey, salonName, googleClientId }) {
  const name = String(salonName || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const google = String(googleClientId || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return 'window.APP_CONFIG = {\n' +
    '  SUPABASE_URL: "' + url + '",\n' +
    '  SUPABASE_ANON_KEY: "' + anonKey + '",\n' +
    '  SALON_NAME: "' + name + '",\n' +
    '  GOOGLE_CLIENT_ID: "' + google + '"\n' +
    '};\n'
}

/** Copy only the deployable website files and write the client's config.js. */
export async function writeClientSite({ root, target, url, anonKey, salonName, googleClientId }) {
  await mkdir(target, { recursive: true })
  for (const dir of DEPLOY_DIRS) {
    const from = path.join(root, dir)
    try {
      await stat(from)
    } catch (_e) {
      continue
    }
    await cp(from, path.join(target, dir), { recursive: true })
  }
  for (const file of DEPLOY_FILES) {
    const from = path.join(root, file)
    try {
      await stat(from)
    } catch (_e) {
      continue
    }
    await cp(from, path.join(target, file))
  }
  // The old per-deployment file lived in js/; never ship it with a client copy.
  await rm(path.join(target, 'js', 'config.js'), { force: true })
  await writeFile(path.join(target, 'config.js'), configSource({ url, anonKey, salonName, googleClientId }), 'utf8')
}

/**
 * Full flow used by the CLI. Every network call is injected, so the flow can
 * be unit-tested without touching Supabase.
 */
export async function provisionClient({
  token,
  organizationId,
  name,
  region,
  dbPass,
  adminEmail,
  adminPassword,
  siteUrl,
  root,
  clientsDir,
  sql,
  googleClientId = '',
  fetchImpl = fetch,
  sleep,
  log = () => {},
  onProjectCreated = () => {}
}) {
  const slug = slugify(name)
  const clientDir = path.join(clientsDir, slug)
  const siteDir = path.join(clientDir, 'site')
  const project = await createProject({ token, organizationId, name, region, dbPass, fetchImpl })
  const ref = project.ref
  const url = 'https://' + ref + '.supabase.co'
  onProjectCreated({ ref, url, project })
  log('   project created: ' + ref + ' — waiting for the database…')

  await waitForProject({ token, ref, fetchImpl, sleep, log })
  log('   database is healthy — applying schema.sql…')
  await runSql({ token, ref, sql, fetchImpl })

  const keys = await getProjectKeys({ token, ref, fetchImpl })
  if (!keys.service) throw new Error('Service-role key was not returned by the Management API')

  log('   creating the admin account…')
  await createAdminUser({ projectUrl: url, serviceKey: keys.service, email: adminEmail, password: adminPassword, fetchImpl })

  let authConfigured = true
  try {
    await configureAuth({ token, ref, siteUrl, fetchImpl })
  } catch (_e) {
    authConfigured = false
  }

  log('   writing ' + siteDir)
  await writeClientSite({ root, target: siteDir, url, anonKey: keys.anon, salonName: name, googleClientId })
  await writeFile(
    path.join(clientDir, 'client.json'),
    JSON.stringify(
      {
        name,
        slug,
        ref,
        url,
        region,
        organizationId,
        adminEmail,
        siteUrl: siteUrl || '',
        authConfigured,
        siteFolder: 'site',
        createdAt: new Date().toISOString()
      },
      null,
      2
    ) + '\n',
    'utf8'
  )

  return { slug, ref, url, clientDir, siteDir, anonKey: keys.anon, serviceKey: keys.service, authConfigured }
}

export async function readSchema(root) {
  return readFile(path.join(root, 'schema.sql'), 'utf8')
}
