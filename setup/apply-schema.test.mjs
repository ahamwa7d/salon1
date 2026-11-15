import test from 'node:test'
import assert from 'node:assert/strict'
import { projectRef, normalizeToken } from './apply-schema.mjs'

test('projectRef accepts a ref, a project URL and a dashboard URL', () => {
  assert.equal(projectRef('lbhzplpucqbzxzjjgfbv'), 'lbhzplpucqbzxzjjgfbv')
  assert.equal(projectRef('https://lbhzplpucqbzxzjjgfbv.supabase.co'), 'lbhzplpucqbzxzjjgfbv')
  assert.equal(projectRef('https://lbhzplpucqbzxzjjgfbv.supabase.co/'), 'lbhzplpucqbzxzjjgfbv')
  assert.equal(projectRef('https://supabase.com/dashboard/project/lbhzplpucqbzxzjjgfbv/sql/new'), 'lbhzplpucqbzxzjjgfbv')
  assert.equal(projectRef(''), '')
  assert.equal(projectRef('not-a-ref'), '')
})

test('normalizeToken only accepts personal access tokens', () => {
  assert.equal(normalizeToken('sbp_abc123'), 'sbp_abc123')
  assert.equal(normalizeToken('  sbp_abc123  '), 'sbp_abc123')
  assert.equal(normalizeToken('anon-key'), '')
  assert.equal(normalizeToken(undefined), '')
})
