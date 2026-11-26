#!/usr/bin/env node
/*
 * Link an uploaded copy of the site to one Supabase project.
 *
 *   npm run configure
 *
 * It writes ./config.js with the project URL and the publishable/anon key.
 * Nothing else in the site is client-specific; everything the client sees is
 * edited from Admin → Settings and Admin → Pages after the first login.
 *
 * config.js is listed in .gitignore: the normal path is install.html → n8n,
 * which creates it in the client's own repository. This script is the manual
 * fallback for hosting outside GitHub Pages.
 *
 * The key is the public one. The service_role key is rejected on purpose.
 */
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const configPath = path.join(root, 'config.js')

/** Accept a bare ref, a project URL or a dashboard URL; return the project URL. */
export function normalizeProjectUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  const match = raw.match(/([a-z0-9]{20})\.supabase\.co/i) || raw.match(/\/project\/([a-z0-9]{20})/i)
  const ref = match ? match[1] : (/^[a-z0-9]{20}$/i.test(raw) ? raw : '')
  return ref ? 'https://' + ref.toLowerCase() + '.supabase.co' : ''
}

/** Publishable keys (sb_publishable_…) or legacy anon JWTs. Never service_role. */
export function normalizeKey(value) {
  const key = String(value || '').trim()
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return key
  if (/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return key
  return ''
}

export function configSource({ url, anonKey, salonName }) {
  const name = String(salonName || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return '// Generated for THIS deployment by `npm run configure` — do not commit.\n' +
    'window.APP_CONFIG = {\n' +
    '  SUPABASE_URL: "' + url + '",\n' +
    '  SUPABASE_ANON_KEY: "' + anonKey + '",\n' +
    '  SALON_NAME: "' + name + '"\n' +
    '};\n'
}

function decodedName(source) {
  const match = String(source || '').match(/SALON_NAME:\s*"((?:\\\\.|[^"\\\\])*)"/)
  if (!match) return ''
  return match[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"')
}

async function main() {
  const rl = createInterface({ input, output })
  const ask = async (question, fallback) => {
    const answer = (await rl.question(question)).trim()
    return answer || fallback || ''
  }

  try {
    console.log('\n=== ربط الموقع بمشروع Supabase ===\n')
    console.log('القيم من: Supabase → Project Settings → API\n')

    const url = normalizeProjectUrl(process.env.SUPABASE_PROJECT_URL || (await ask('Project URL (أو ref): ')))
    if (!url) throw new Error('رابط المشروع غير صحيح. مثال: https://abcdefghijklmnopqrst.supabase.co')

    const key = normalizeKey(process.env.SUPABASE_ANON_KEY || (await ask('publishable / anon key: ')))
    if (!key) {
      throw new Error('المفتاح غير صحيح. استخدم publishable key (يبدأ بـ sb_publishable_) أو anon JWT — وليس service_role.')
    }

    const previous = await readFile(configPath, 'utf8').catch(() => '')
    const salonName = await ask('اسم الصالون (اختياري — Enter للإبقاء): ', decodedName(previous))
    const changed = !previous.includes('SUPABASE_URL: "' + url + '"') || !previous.includes('SUPABASE_ANON_KEY: "' + key + '"')
    await writeFile(configPath, configSource({ url, anonKey: key, salonName }), 'utf8')

    console.log('\n✅ تم تحديث config.js')
    console.log('   ' + url)
    console.log('   ' + key.slice(0, 18) + '…')
    if (!changed) console.log('   (كان مربوطًا بهذا المشروع بالفعل)')
    console.log('\nالخطوات التالية:')
    console.log('  1) ارفع ملفات الموقع (index.html, admin.html, privacy.html, terms.html, usage-policy.html, manifest.webmanifest, sw.js, config.js, css/, js/, img/, .htaccess, robots.txt).')
    console.log('  2) أنشئ حساب المدير في Supabase → Authentication → Users (Auto Confirm)، وأوقف التسجيل العام.')
    console.log('  3) افتح الموقع → دخول النظام → الإدارة: عبّئ الاسم والشعار والتواصل وSEO، وأرسل للعميل بيانات الدخول.')
    console.log('')
  } finally {
    rl.close()
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  main().catch((error) => {
    console.error('\n❌ ' + (error && error.message ? error.message : error))
    process.exitCode = 1
  })
}
