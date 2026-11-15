// ─────────────────────────────────────────────────────────────────────────────
// Supabase connection for THIS deployment.
//
// These two values are the only thing that differs between two clients. Fill
// them once per deployment (or run `npm run configure`), then upload the site.
// After that, the client changes everything else — name, logo, phone, address,
// social links, SEO, legal pages — from Admin inside the dashboard.
//
// Where to find them: Supabase Dashboard → Project Settings → API
//   url      https://<project-ref>.supabase.co
//   anonKey  the publishable key (or the legacy "anon public" key)
//
// Only the public key belongs in this file. Never put service_role here: it
// bypasses every RLS policy and would expose the whole database.
//
// While the placeholders below are unchanged the site refuses to connect and
// shows a "setup required" banner instead of failing silently.
// ─────────────────────────────────────────────────────────────────────────────
window.SB_CONFIG = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  anonKey: 'YOUR-PUBLISHABLE-OR-ANON-KEY'
}
