// Template for ./config.js — copy it to config.js when setting up a site by
// hand. In the normal flow install.html → n8n writes config.js automatically
// for every salon, and the file is excluded through .gitignore.
//
// Public, browser-safe values only. Never add a service_role key, a database
// password or an API secret: this file is readable by every visitor.
window.APP_CONFIG = {
  SUPABASE_URL: "%%SUPABASE_URL%%",
  SUPABASE_ANON_KEY: "%%SUPABASE_ANON_KEY%%",
  SALON_NAME: "%%SALON_NAME%%",
  GOOGLE_CLIENT_ID: "%%GOOGLE_CLIENT_ID%%"
};
