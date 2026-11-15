import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, cp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  slugify,
  getProjectKeys,
  waitForProject,
  provisionClient,
  configSource
} from './provision.mjs'

function recorder(routes) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    const key = (init.method || 'GET') + ' ' + url
    calls.push({ key, body: init.body ? JSON.parse(init.body) : null, headers: init.headers })
    const handler = routes[key] || routes[url] || routes[(init.method || 'GET') + ' ' + new URL(url).origin + new URL(url).pathname]
    if (!handler) throw new Error('Unhandled request: ' + key)
    const result = typeof handler === 'function' ? handler(init) : handler
    const envelope = result && typeof result === 'object' && 'body' in result && (result.status == null || typeof result.status === 'number')
    const body = envelope ? result.body : result
    return new Response(JSON.stringify(body), {
      status: envelope && typeof result.status === 'number' ? result.status : 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  return { fetchImpl, calls }
}

test('slugify keeps a stable, url-safe folder name', () => {
  assert.equal(slugify('Nelly Nails Salon'), 'nelly-nails-salon')
  assert.equal(slugify('  صالون  '), 'client')
  assert.equal(slugify('A/B  C!'), 'a-b-c')
})

test('getProjectKeys accepts common API key shapes', async () => {
  const { fetchImpl } = recorder({
    'GET https://api.supabase.com/v1/projects/ref1/api-keys': [
      { name: 'anon', api_key: 'public-anon' },
      { name: 'service_role', api_key: 'secret-service' }
    ]
  })
  const keys = await getProjectKeys({ token: 't', ref: 'ref1', fetchImpl })
  assert.equal(keys.anon, 'public-anon')
  assert.equal(keys.service, 'secret-service')
})

test('waitForProject retries until the database is healthy', async () => {
  let n = 0
  const statuses = ['COMING_UP', 'ACTIVE_HEALTHY']
  const { fetchImpl } = recorder({
    'GET https://api.supabase.com/v1/projects/ref1': () => ({ status: statuses[n++] })
  })
  const project = await waitForProject({
    token: 't',
    ref: 'ref1',
    fetchImpl,
    intervalMs: 1,
    sleep: async () => {}
  })
  assert.equal(project.status, 'ACTIVE_HEALTHY')
  assert.equal(n, 2)
})

test('waitForProject gives up on a failed provisioning status', async () => {
  const { fetchImpl } = recorder({
    'GET https://api.supabase.com/v1/projects/ref1': { status: 'RESTORE_FAILED' }
  })
  await assert.rejects(
    waitForProject({ token: 't', ref: 'ref1', fetchImpl, sleep: async () => {} }),
    /RESTORE_FAILED/
  )
})

test('configSource quotes values safely', () => {
  const src = configSource({ url: 'https://x.supabase.co', anonKey: 'sb_publishable_x' })
  assert.match(src, /https:\/\/x\.supabase\.co/)
  assert.match(src, /sb_publishable_x/)
})

test('provisionClient creates the project, applies SQL and writes a deployable site', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'salon-root-'))
  const clientsDir = await mkdtemp(path.join(os.tmpdir(), 'salon-clients-'))

  await writeFile(path.join(root, 'index.html'), '<html>site</html>', 'utf8')
  await mkdir(path.join(root, 'css'), { recursive: true })
  await writeFile(path.join(root, 'css', 'tailwind.css'), 'body{}', 'utf8')
  await mkdir(path.join(root, 'js'), { recursive: true })
  await writeFile(path.join(root, 'js', 'config.js'), 'OLD', 'utf8')
  await writeFile(path.join(root, 'js', 'app.min.js'), 'app', 'utf8')
  await mkdir(path.join(root, 'img'), { recursive: true })
  await writeFile(path.join(root, 'img', 'x.jpg'), 'img', 'utf8')
  await writeFile(path.join(root, 'robots.txt'), 'robots', 'utf8')
  await writeFile(path.join(root, '.htaccess'), 'htaccess', 'utf8')
  await writeFile(path.join(root, 'src.js'), 'do not copy', 'utf8')

  const { fetchImpl, calls } = recorder({
    'POST https://api.supabase.com/v1/projects': () => ({ ref: 'ref123' }),
    'GET https://api.supabase.com/v1/projects/ref123': () => ({ status: 'ACTIVE_HEALTHY' }),
    'POST https://api.supabase.com/v1/projects/ref123/database/query': { ok: true },
    'GET https://api.supabase.com/v1/projects/ref123/api-keys': [
      { name: 'anon', api_key: 'anon123' },
      { name: 'service_role', api_key: 'service123' }
    ],
    'POST https://ref123.supabase.co/auth/v1/admin/users': { id: 'user-1' },
    'PATCH https://api.supabase.com/v1/projects/ref123/config/auth': {}
  })

  const result = await provisionClient({
    token: 'sbp_test',
    organizationId: 'org1',
    name: 'Nelly Nails Salon',
    region: 'ap-southeast-1',
    dbPass: 'db-secret',
    adminEmail: 'admin@example.com',
    adminPassword: 'admin-secret',
    siteUrl: 'https://example.com',
    root,
    clientsDir,
    sql: 'select 1;',
    fetchImpl,
    sleep: async () => {}
  })

  assert.equal(result.ref, 'ref123')
  assert.equal(result.url, 'https://ref123.supabase.co')
  assert.equal(result.slug, 'nelly-nails-salon')

  const siteIndex = await readFile(path.join(result.siteDir, 'index.html'), 'utf8')
  assert.match(siteIndex, /site/)

  const config = await readFile(path.join(result.siteDir, 'js', 'config.js'), 'utf8')
  assert.match(config, /https:\/\/ref123\.supabase\.co/)
  assert.match(config, /anon123/)
  assert.doesNotMatch(config, /service123/)

  const app = await readFile(path.join(result.siteDir, 'js', 'app.min.js'), 'utf8')
  assert.equal(app, 'app')

  const clientJson = await readFile(path.join(result.clientDir, 'client.json'), 'utf8')
  assert.match(clientJson, /ref123/)
  assert.doesNotMatch(clientJson, /service123/)
  assert.doesNotMatch(clientJson, /admin-secret/)
  assert.doesNotMatch(clientJson, /db-secret/)

  const sqlCall = calls.find((c) => c.key.includes('/database/query'))
  assert.equal(sqlCall.body.query, 'select 1;')

  const projectCall = calls.find((c) => c.key === 'POST https://api.supabase.com/v1/projects')
  assert.equal(projectCall.body.organization_id, 'org1')
  assert.equal(projectCall.body.db_pass, 'db-secret')

  const authCall = calls.find((c) => c.key.includes('/auth/v1/admin/users'))
  assert.equal(authCall.body.email, 'admin@example.com')
  assert.equal(authCall.headers.apikey, 'service123')
})
