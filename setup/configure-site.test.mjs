import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProjectUrl, normalizeKey, configSource } from './configure-site.mjs'

test('normalizeProjectUrl accepts a ref, a project URL and a dashboard URL', () => {
  assert.equal(normalizeProjectUrl('abcdefghijklmnopqrst'), 'https://abcdefghijklmnopqrst.supabase.co')
  assert.equal(normalizeProjectUrl('https://abcdefghijklmnopqrst.supabase.co'), 'https://abcdefghijklmnopqrst.supabase.co')
  assert.equal(normalizeProjectUrl('https://abcdefghijklmnopqrst.supabase.co/'), 'https://abcdefghijklmnopqrst.supabase.co')
  assert.equal(normalizeProjectUrl('https://supabase.com/dashboard/project/abcdefghijklmnopqrst/sql/new'), 'https://abcdefghijklmnopqrst.supabase.co')
  assert.equal(normalizeProjectUrl('nope'), '')
  assert.equal(normalizeProjectUrl(''), '')
})

test('normalizeKey accepts publishable keys and anon JWTs only', () => {
  assert.equal(normalizeKey('sb_publishable_09KQ2mj41vFFcIBsJ_ppEQ'), 'sb_publishable_09KQ2mj41vFFcIBsJ_ppEQ')
  assert.match(normalizeKey('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl'), /^eyJ/)
  assert.equal(normalizeKey('not-a-key'), '')
  assert.equal(normalizeKey(''), '')
})

test('configSource writes both values into window.SB_CONFIG', () => {
  const src = configSource({ url: 'https://x.supabase.co', anonKey: 'sb_publishable_abc123456789' })
  assert.match(src, /url: 'https:\/\/x\.supabase\.co'/)
  assert.match(src, /anonKey: 'sb_publishable_abc123456789'/)
  assert.match(src, /window\.SB_CONFIG/)
})
