// Template for ./config.js — copy it to config.js when setting up a site by
// hand. In the normal flow install.html → n8n writes config.js automatically
// for every salon, and the file is excluded through .gitignore.
window.APP_CONFIG = {
  SUPABASE_URL: "%%SUPABASE_URL%%",
  SUPABASE_ANON_KEY: "%%SUPABASE_ANON_KEY%%",
  SALON_NAME: "%%SALON_NAME%%"
};
