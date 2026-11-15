#!/usr/bin/env node
/*
 * Apply supabase/schema.sql to an existing Supabase project.
 *
 *   npm run apply-schema
 *
 * Use this when a project already exists (for example the seller's own demo
 * project) and only the database schema is out of date. It asks for a Supabase
 * Personal Access Token (never written to disk), applies the whole schema
 * through the Management API, then verifies the public RPCs that the website
 * depends on.
 */
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { getProjectKeys, managementApi, runSql } from './provision.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

async function rpc(projectUrl, anonKey, fn, body) {
  const res = await fetch(projectUrl + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  })
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  return { ok: res.ok, status: res.status, data: parsed }
}

/** Turn a project URL or ref into a bare ref. */
export function projectRef(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  const match = raw.match(/([a-z0-9]{20})\.supabase\.co/i) || raw.match(/\/project\/([a-z0-9]{20})/i)
  if (match) return match[1]
  if (/^[a-z0-9]{20}$/i.test(raw)) return raw
  return ''
}

export function normalizeToken(value) {
  const token = String(value || '').trim()
  return token.startsWith('sbp_') ? token : ''
}

async function main() {
  const rl = createInterface({ input, output })
  const ask = async (question, fallback) => {
    const answer = (await rl.question(question)).trim()
    return answer || fallback || ''
  }

  try {
    console.log('\n=== تطبيق supabase/schema.sql على مشروع موجود ===\n')
    console.log('نحتاج Personal Access Token من: https://supabase.com/dashboard/account/tokens')
    console.log('التوكن يبقى على جهازك فقط ولا يُحفظ في أي ملف.\n')

    const token = normalizeToken(process.env.SUPABASE_ACCESS_TOKEN || (await ask('Supabase access token (sbp_…): ')))
    if (!token) throw new Error('التوكن غير صالح. يجب أن يبدأ بـ sbp_.')

    const ref = projectRef(process.env.SUPABASE_PROJECT_REF || (await ask('Project ref (أو رابط المشروع): ')))
    if (!ref) throw new Error('معرّف المشروع غير صحيح.')

    console.log('\nجارٍ قراءة المشروع…')
    const project = await managementApi(fetch, token, '/v1/projects/' + ref)
    console.log('  المشروع: ' + (project.name || ref) + '  (' + ref + ')')
    console.log('  الحالة: ' + (project.status || 'UNKNOWN'))

    const sql = await readFile(path.join(root, 'supabase', 'schema.sql'), 'utf8')
    console.log('\nجارٍ تطبيق المخطط (' + sql.split('\n').length + ' سطرًا)…')
    await runSql({ token, ref, sql })
    console.log('  ✅ تم تنفيذ المخطط.')

    console.log('\nجارٍ التحقق من الدوال العامة…')
    const url = 'https://' + ref + '.supabase.co'
    let anon = ''
    try {
      anon = (await getProjectKeys({ token, ref })).anon
    } catch (error) {
      console.log('  ⚠️ تعذّر جلب anon key: ' + (error && error.message))
    }

    if (anon) {
      const info = await rpc(url, anon, 'public_info')
      const keys = info.ok && Array.isArray(info.data) && info.data[0] ? Object.keys(info.data[0]) : []
      console.log('  public_info: ' + (info.ok ? '✅ ' + keys.length + ' حقلًا' : '❌ ' + info.status))
      for (const slug of ['privacy', 'terms', 'usage']) {
        const page = await rpc(url, anon, 'public_legal_page', { p_slug: slug })
        const row = page.ok && Array.isArray(page.data) ? page.data[0] : null
        const title = row && (row.title_ar || row.title_en)
        console.log('  public_legal_page(' + slug + '): ' + (page.ok && row ? '✅ ' + String(title || '').slice(0, 40) : '❌ ' + page.status))
      }
      const buckets = await fetch(url + '/storage/v1/bucket/branding', {
        headers: { apikey: anon, Authorization: 'Bearer ' + anon }
      })
      console.log('  bucket branding: ' + (buckets.ok ? '✅ موجود' : '❌ ' + buckets.status))
    }

    console.log('\nتم. افتح الموقع وأعد تحميله (Ctrl+F5) لرؤية الهوية الجديدة.')
    console.log('')
  } finally {
    rl.close()
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((error) => {
    console.error('\n❌ ' + (error && error.message ? error.message : error))
    console.error('لم يتم التأكد من تطبيق المخطط. راجع setup/README.md أو نفّذه من SQL Editor.')
    process.exitCode = 1
  })
}
