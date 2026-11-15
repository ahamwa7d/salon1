// Template for linking this site to ONE Supabase project.
//
// Copy this file to js/config.js and fill in the two values of the target
// project (Dashboard -> Project Settings -> API):
//
//   url      https://<project-ref>.supabase.co
//   anonKey  the publishable / anon key
//
// Only the public key belongs here. Never put the service_role key in a file
// that is uploaded to a website: it bypasses every RLS policy.
window.SB_CONFIG = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  anonKey: 'YOUR-PUBLISHABLE-OR-ANON-KEY'
}
