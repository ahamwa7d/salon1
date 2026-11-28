#!/usr/bin/env node
/*
 * One-command client provisioning for the seller.
 *
 *   npm run new-client
 *
 * It asks for a Supabase Personal Access Token, creates a dedicated project,
 * applies schema.sql, creates the admin login and writes:
 *
 *   clients/<slug>/site/   upload this folder to the client's hosting
 *   clients/<slug>/client.json
 *
 * Nothing secret is written to disk.
 */
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_REGION,
  listOrganizations,
  listRegions,
  provisionClient,
  readSchema
} from './provision.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const clientsDir = path.join(root, 'clients')

function strongPassword() {
  // URL-safe, 24 chars, includes letters, digits and symbols Supabase accepts.
  return randomBytes(18).toString('base64url') + '!7a'
}

function line(label, value) {
  console.log('  ' + label.padEnd(22) + value)
}

async function main() {
  const rl = createInterface({ input, output })
  const ask = async (question, fallback) => {
    const answer = (await rl.question(question)).trim()
    return answer || fallback || ''
  }

  try {
    console.log('\n=== إنشاء عميل جديد (Supabase + موقع جاهز للنشر) ===\n')
    console.log('نحتاج Personal Access Token من: https://supabase.com/dashboard/account/tokens')
    console.log('التوكن يبقى على جهازك فقط ولا يُحفظ في أي ملف.\n')

    const token = process.env.SUPABASE_ACCESS_TOKEN || (await ask('Supabase access token (sbp_…): '))
    if (!token || !token.startsWith('sbp_')) {
      throw new Error('التوكن غير صالح. يجب أن يبدأ بـ sbp_.')
    }

    console.log('\nجارٍ قراءة المنظمات…')
    const orgs = await listOrganizations({ token })
    if (!orgs.length) throw new Error('لا توجد منظمات مرتبطة بهذا التوكن.')

    let organization
    if (orgs.length === 1) {
      organization = orgs[0]
      console.log('  المنظمة: ' + (organization.name || organization.slug || organization.id))
    } else {
      console.log('')
      orgs.forEach((org, i) => console.log('  ' + (i + 1) + ') ' + (org.name || org.slug || org.id)))
      const choice = Number(await ask('\nاختر رقم المنظمة [1]: ', '1'))
      organization = orgs[choice - 1]
      if (!organization) throw new Error('اختيار غير صحيح.')
    }

    const name = await ask('\nاسم العميل / المشروع (مثال: Nelly Nails Salon): ')
    if (name.length < 2) throw new Error('اسم المشروع قصير جدًا.')

    const regions = await listRegions({ token })
    const defaultRegion = regions.some((r) => r.id === DEFAULT_REGION) ? DEFAULT_REGION : regions[0].id
    console.log('\nالمناطق المتاحة:')
    regions.slice(0, 12).forEach((r, i) => console.log('  ' + (i + 1) + ') ' + r.id + '  —  ' + r.name))
    const regionAnswer = await ask('\nمنطقة المشروع [' + defaultRegion + ']: ', defaultRegion)
    const region = /^\d+$/.test(regionAnswer)
      ? (regions[Number(regionAnswer) - 1] || {}).id
      : regionAnswer
    if (!region) throw new Error('منطقة غير صحيحة.')

    const dbPass = await ask('\nكلمة مرور قاعدة البيانات [توليد قوية تلقائيًا]: ', strongPassword())
    if (dbPass.length < 8) throw new Error('كلمة مرور القاعدة يجب أن تكون 8 أحرف على الأقل.')

    const adminEmail = await ask('\nبريد حساب المدير للعميل: ')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) throw new Error('بريد المدير غير صحيح.')
    const adminPassword = await ask('كلمة مرور المدير [توليد قوية تلقائيًا]: ', strongPassword())

    const siteUrl = await ask('\nرابط موقع العميل (اتركه فارغًا الآن إن لم يكن جاهزًا): ', '')

    // Optional: enables the browser-side Drive backup in Admin → Backup.
    // This is a public OAuth client ID, never a secret.
    const googleClientId = await ask(
      '\nGoogle OAuth Client ID للنسخ الاحتياطي (اختياري — Enter للتخطي): ',
      process.env.GOOGLE_CLIENT_ID || ''
    )

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'client'
    console.log('\n--- ملخص ---')
    line('المنظمة', organization.name || organization.slug || organization.id)
    line('المشروع', name + '  (' + slug + ')')
    line('المنطقة', region)
    line('المدير', adminEmail)
    line('مجلد الموقع', 'clients/' + slug + '/site')
    console.log('\nسيتم الآن إنشاء مشروع Supabase جديد (قد يستغرق 1–3 دقائق).')
    const proceed = await ask('اكتب "نعم" للمتابعة: ')
    if (proceed !== 'نعم' && proceed.toLowerCase() !== 'yes' && proceed !== 'y') {
      console.log('تم الإلغاء.')
      return
    }

    const sql = await readSchema(root)
    const result = await provisionClient({
      token,
      organizationId: organization.id,
      name,
      region,
      dbPass,
      adminEmail,
      adminPassword,
      siteUrl,
      googleClientId,
      root,
      clientsDir,
      sql,
      log: (message) => console.log(message)
    })

    console.log('\n✅ تم إنشاء العميل بنجاح.\n')
    line('Project ref', result.ref)
    line('Project URL', result.url)
    line('مجلد النشر', result.siteDir)
    line('بريد المدير', adminEmail)
    line('كلمة مرور المدير', adminPassword)
    line('كلمة مرور القاعدة', dbPass)
    line('anon key', result.anonKey)
    line('service_role key', result.serviceKey)
    console.log('\n⚠️  احفظ كلمة مرور القاعدة والـ service_role الآن — لن تُكتب في أي ملف.')
    console.log('\nالخطوات التالية:')
    console.log('  1) ارفع محتوى المجلد أعلاه إلى استضافة العميل (public_html).')
    if (!result.authConfigured) {
      console.log('  2) في Supabase: Authentication → Sign In / Providers → أوقف التسجيل العام، واضبط Site URL.')
    } else {
      console.log('  2) تم إيقاف التسجيل العام تلقائيًا. راجع Site URL إذا كان الموقع جاهزًا.')
    }
    console.log('  3) افتح الموقع → دخول النظام → Admin → Settings: ارفع الشعار واملأ الاسم والهاتف والعنوان والتواصل.')
    console.log('  4) Admin → Pages: راجع الصفحات القانونية (تمت تعبئتها بنسخة كاملة).')
    console.log('')
  } finally {
    rl.close()
  }
}

main().catch((error) => {
  console.error('\n❌ ' + (error && error.message ? error.message : error))
  console.error('لم يتم إنشاء مجلد العميل. أعد المحاولة أو راجع setup/README.md.')
  process.exitCode = 1
})
