# Salon POS — White-label Website, POS & Management

A lightweight, bilingual (Arabic / English) beauty salon website with online booking, a full POS, staff commissions, expenses tracking, Google Sheets backup and Bahrain VAT reporting.

- **Frontend:** static SPA — HTML5, Tailwind CSS, Alpine.js, Chart.js, Cairo font
- **Backend:** Supabase only (PostgreSQL + Row Level Security + Auth + database triggers)
- **Server requirement:** none. Deploy the static files to GitHub Pages; all data operations go straight to Supabase.
- **Self-installer:** `install.html` + the n8n workflow create the client's repo, Supabase project, database and admin account from the client's own accounts.
- **Currency:** Bahraini Dinar (BHD, 3 decimals)
- **Timezone:** Asia/Bahrain (UTC+3) used for appointments, reports and grouping

---

## 1. Features

### Public landing page & online booking
- Professional ladies-salon landing page: hero, services, about, gallery, booking and contact map
- Instant Arabic (RTL) / English (LTR) switch shared with the POS
- Fully white-label: name, logo, tagline, photos, contact, social links and SEO come from the database
- Local, licensed service photos mapped automatically from each service name
- Guests see service names and pictures only — **prices stay private**
- Online booking with service, staff member, date/time, phone and optional notes
- Database-side abuse limits (3 live bookings per phone / 24h, 40 bookings/hour globally)
- Official 6-digit invoice number returned on the success card

### POS & booking (staff / admin)
- Client name and phone, service and staff dropdowns populated from Supabase
- Live BHD total, VAT portion and staff commission calculation
- Appointment date/time picker, BenefitPay / transfer reference field
- Animated success card with optional WhatsApp message to the salon
- Today's appointment queue with one-tap complete / cancel / WhatsApp actions

### Admin (authenticated)
- Services CRUD with Arabic + English names, price and show/hide (no duration field)
- Staff CRUD with individual commission percentages and phone
- Appointment search, status filter, date filter, status change and delete
- Settings for salon name, public contact details, VAT rate/registration number, admin WhatsApp,
  Evolution API and Google Sheets sync
- Brand identity card (logo, hero/about images, taglines, about text), social links and SEO fields
- Legal-page editor for privacy, terms and usage policies with live placeholders and safe HTML

### Reports
- Custom date range plus Today / This Month / Last Month / This Year shortcuts
- Daily **or** monthly revenue trend
- KPIs: completed services, total bookings, revenue, commissions, average ticket, total expenses and net profit
- Expense breakdown by method (cash / BenefitPay) and a detailed expense table for the period
- Doughnut breakdown of sales, expenses, commissions and net profit (with values under the chart)
- Staff performance table with revenue share, service popularity doughnut, revenue line, staff bar chart

### Expenses (admin + staff)
- Both the admin account and staff accounts can record salon expenses
- Fields: title, amount, method (**Cash** or **BenefitPay**), expense date and optional notes
- Optional **VAT fields** for Bahrain VAT: supplier / shop name, supplier VAT registration
  number, supplier invoice number and the VAT amount (input tax). Net before VAT is calculated
  automatically, and a one-click **Calculate VAT** button estimates it from the configured rate.
- All tax fields are optional; record only what appears on the supplier invoice
- Admin sees all expenses with a date filter and running totals; staff can add expenses but **cannot
  view, total or delete** them (the database also revokes the read/delete RPCs from staff)
- Expenses are included in reports: total expenses, cash/BenefitPay split, **input VAT** and **net profit**
  (`profit = completed revenue − commissions − expenses`)
- The VAT report also shows **input VAT (expenses)** and **net VAT due** (output VAT − input VAT)
- Each expense is mirrored to the **Expenses** tab of the connected Google Sheet, including the
  supplier, VAT number, invoice number, net and VAT amounts

### VAT (NBR Bahrain)
- Configurable rate (default 10%), inclusive or exclusive pricing
- Gross sales, net taxable amount and VAT collected aggregation
- Monthly breakdown table
- Print-ready A4 VAT summary and CSV export (Excel-friendly, UTF-8 BOM)

### Security
- The **public landing page** is intentionally open, but shows only service names/pictures and staff
  names. The POS, reports, VAT, admin and customer data stay behind the staff/admin login.
- RLS is enabled on every table and **anonymous visitors have no table access at all**.
  Guests only reach a small set of `SECURITY DEFINER` RPCs: the public ones
  (`public_info`, `public_legal_page`, `public_services`, `public_staff_list`, `public_booking`) plus the token-gated
  staff ones (`staff_login`, `staff_me`, `staff_services`, `staff_settings`, `staff_list`,
  `staff_create_booking`, `staff_appointments`, `staff_set_appointment_status`, `staff_logout`,
  `staff_create_expense`).
  Every staff RPC requires a valid session token.
- Staff read their **own** appointments only, never commission, reports, VAT, other staff phone numbers
  or any expense records. They can add an expense, but the read and delete expense functions are
  revoked from the API (`staff_expenses`, `staff_delete_expense`).
- Staff tokens are random UUIDs; the database stores only their SHA-256 hash, so a database leak
  cannot be replayed against the API. Sessions expire after 12 hours.
- Staff passwords and the shared access code are bcrypt-hashed (`pgcrypto`). Passwords are never
  returned to the browser.
- Failed staff logins are throttled (8 attempts per username / 15 minutes).
- Prices and commissions are recalculated by a database trigger — clients cannot tamper with totals.
- Only an authenticated admin (Supabase Auth) can manage staff logins, the access code and all settings.

---

## 2. File structure

```
salon-pos/
├── index.html              # Landing page + SPA UI (Arabic RTL / English LTR)
├── admin.html              # Shortcut that opens the manager login (index.html?entry=admin)
├── install.html            # One-click installer: licence → GitHub OAuth → Supabase OAuth → launch
├── privacy.html            # Legal page shell — content comes from the database
├── terms.html              # Legal page shell — content comes from the database
├── usage-policy.html       # Legal page shell — content comes from the database
├── manifest.webmanifest    # Installable-app manifest (name, colours, icons)
├── sw.js                   # Service worker: offline shell + instant updates
├── config.js               # ACTIVE connection file (git-ignored, written by the installer)
├── config.example.js       # Template for window.APP_CONFIG
├── schema.sql              # Complete database schema executed by the installer
├── salon-full-auto-installer.json  # n8n workflow (seller-side, never uploaded)
├── img/
│   ├── og-cover.jpg        # Fallback social sharing image
│   ├── icon-192.png        # Home-screen icon (Android)
│   ├── icon-512.png        # Home-screen icon (splash / stores)
│   ├── icon-maskable-512.png
│   ├── apple-touch-icon.png
│   └── services/           # Local service / hero / about photos
├── css/
│   ├── input.css           # Tailwind source directives
│   └── tailwind.css        # Compiled production CSS
├── js/
│   ├── branding.js         # Shared loader for name, logo, contact, social, legal text
│   ├── i18n.min.js         # Compiled (minified) English / Arabic strings
│   └── app.min.js          # Compiled (minified) Alpine app logic
├── src/                    # SOURCE — keep private, never upload
│   ├── i18n.js             # All Arabic / English interface strings
│   └── app.js              # Alpine app state, Supabase RPC calls, charts, VAT
├── supabase/               # SOURCE — keep private, never upload
│   ├── salon-licenses.sql  # Licence table for the seller's master project
│   └── seed.sql            # Optional demo services and staff
├── setup/                  # SOURCE — seller-only client provisioning (never upload)
│   ├── create-client.cmd    # Windows double-click launcher
│   ├── new-client.mjs      # npm run new-client
│   ├── apply-schema.mjs    # npm run apply-schema (existing project)
│   ├── configure-site.mjs  # npm run configure (link this copy to a project)
│   ├── provision.mjs       # Management API + site folder logic
│   └── README.md           # Step-by-step provisioning guide
├── clients/                # Generated per-client copies (git-ignored, never upload)
├── tailwind.config.js      # Build config (maintenance only)
├── package.json            # Build scripts (maintenance only)
├── .htaccess               # HTTPS, security headers, caching, source-file denials
└── robots.txt              # Keeps the POS out of search engines
```

**Deploy only:** `index.html`, `admin.html`, `install.html`, `privacy.html`, `terms.html`, `usage-policy.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/`, `img/`, `.htaccess`, `robots.txt` and the per-install `config.js`. Never upload `src/`, `supabase/`, `setup/`, `clients/`, `schema.sql`, `salon-full-auto-installer.json`, `package.json`, `tailwind.config.js` or `node_modules/`.
Never upload `src/`, `supabase/`, `setup/`, `clients/`, `package.json`, `tailwind.config.js` or `node_modules/`.
The shipped JavaScript is minified, and `.htaccess` returns 404 for those source paths even if a
copy is left behind.

### Rebuilding after editing the source
```bash
npm install          # first time only
npm run build        # rebuilds css/tailwind.css + js/app.min.js + js/i18n.min.js
```
Delete `node_modules/` afterwards. `config.js` is never built or minified.

---

## 3. Supabase setup

### 3.1 Create the project
1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the entire contents of the root `schema.sql`.
3. Optionally run `supabase/seed.sql` to load demo services and three staff members.
4. If your project does not allow `CREATE EXTENSION`, enable **pg_net** and **moddatetime** first from
   **Database → Extensions**, then run the SQL again.

### 3.2 Create the admin account
1. Go to **Authentication → Users → Add user**.
2. Enter the salon admin email and a strong password, and confirm the user (auto-confirm).
3. Every authenticated Auth user is a manager. The schema installs an `AFTER INSERT` trigger on
   `auth.users` that creates the matching `public.admins` row automatically, and backfills users that
   existed before the schema ran.
4. Go to **Authentication → Sign In / Providers → Email** and disable **Allow new users to sign up**.
   This is important: every authenticated user is a manager.
5. Set **Authentication → URL Configuration → Site URL** to your production domain.

### 3.3 Connect the frontend
Every page loads the root `config.js` before the app:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-SUPABASE-PUBLISHABLE-KEY',
  SALON_NAME: 'Your Salon'
}
```

Find both values in **Supabase → Project Settings → API**.
Use the **publishable / anon** key only. Never put the `service_role` key in the browser.

`config.js` is **git-ignored**, so the template repository never contains a real project. The one-click
installer writes it for the client. For a manual install, copy `config.example.js` to `config.js`, or run
`npm run configure`, then edit the values. While the file is missing (or still contains `%%…%%`
placeholders) the site shows the Arabic activation banner and links to `install.html`.

### 3.4 Verify
Open `index.html`. You should see the **public landing page** with services and the booking form.
If the activation banner appears, `config.js` is missing or still has placeholders — open `install.html`
or run `npm run configure`. Use **Staff area → Manager account** (or `admin.html`) to sign in with the
admin user, go to **Admin → Settings**, and save the salon and contact details.

> If you previously ran an older `schema.sql`, re-run the current one from the SQL Editor. It is
> idempotent: it adds the new tables/columns/RPCs and revokes anonymous access without deleting data.
> The staff tables gain `username`, `password_hash` and `login_enabled`, and `staff_sessions` is
> recreated (existing staff sessions are simply invalidated — everyone logs in again).

### 3.5 Staff logins (optional)
Staff do **not** use Supabase Auth. They use a username/password created by the admin plus a shared
access code:

1. Sign in as admin → **Admin → Settings** → **Staff Access** → set a **Staff access code** (4+ characters).
2. Go to **Admin → Staff** → add/edit a staff member → fill **Staff login account**:
   - **Username**: 3–32 lowercase letters/numbers/`.`/`-`/`_`
   - **Password**: 6+ characters (leave empty when editing to keep the current password)
   - Enable **Enable staff login**.
3. Staff open **Staff Login** in the header and enter username + password + the access code.
4. A staff session shows only **My Bookings** (her own appointments). Commission rates, reports, VAT,
   and admin settings are not reachable; the database also blocks those reads via RLS.

The access code and passwords are stored hashed (`pgcrypto` bcrypt). Sessions expire after 12 hours
and only the SHA-256 hash of a token is stored. Only the admin can create, change or disable a staff
login. Never enable public sign-ups in Supabase Auth.

### 3.6 What is protected, and what is not
- **Data: protected.** Anonymous visitors have no table access; every read/write goes through RPCs
  that verify a session token, and RLS is enabled everywhere.
- **Credentials: protected.** Only bcrypt hashes are stored; they never reach the browser.
- **Source of the interface: minified but still downloadable.** Any static website ships its HTML/CSS/JS
  to the browser, so the front-end can always be read by a determined visitor. We minify it, and
  `.htaccess` returns 404 for `src/`, `supabase/`, `*.sql`, `*.md`, `package.json` and dotfiles so the
  unminified sources and database scripts are not exposed. All real security lives in PostgreSQL.
- **Brute force: throttled.** After 8 failed staff logins for the same username the endpoint refuses
  attempts for 15 minutes. Use long, unique passwords and keep the access code secret.

### 3.7 White-label branding, contact details & legal pages

The site is sold as separate per-client deployments: one website copy + one Supabase project per salon.
Nothing that belongs to a client (name, logo, phone, address, social links, legal text, SEO) is hard-coded
in the source — all of it lives in `public.settings` and is edited in the admin dashboard.

**Admin → Settings**

| Card | Fields |
| --- | --- |
| **Contact & location** | Phone, opening hours, address, Google Maps link, public email |
| **Brand identity** | Logo (URL or upload), hero image, about image, tagline (AR/EN), about text (AR/EN) |
| **Social media** | Instagram, TikTok, Snapchat, Facebook, X, YouTube, WhatsApp |
| **SEO** | Title (AR/EN), description (AR/EN) |

- **Logo / images** are uploaded to the public `branding` Storage bucket (PNG, JPG, WebP or SVG,
  max 2 MB). Only a signed-in admin can upload or replace files; everyone can read them.
  A bare URL can also be pasted instead of uploading.
- **Phone is optional.** While blank, no phone number, WhatsApp button or call link appears anywhere.
- **Social values** may be full URLs or bare handles such as `instagram.com/salon`; they are completed
  to `https://` automatically. A bare number in WhatsApp becomes `https://wa.me/<number>`.
- **SEO values** update `<title>`, the description meta tag, Open Graph/Twitter tags and the JSON-LD
  business card on the landing page. When blank, sensible bilingual defaults are used.

**Admin → Pages** edits the three legal pages: title, intro and HTML body in Arabic and English.
`privacy.html`, `terms.html` and `usage-policy.html` are thin shells that pull their content from the
database through `public_legal_page(slug)`, so the site never shows a stale hard-coded policy.

Body HTML may use headings, paragraphs, lists and the `card p-5` section style. These placeholders are
replaced with the live settings on render:

`{salon_name}` `{phone}` `{email}` `{address}` `{hours}` `{map_url}` `{website}`

The body is filtered before injection: `<script>`, `<style>`, `<iframe>`, form controls, inline `on*`
handlers and `javascript:` URLs are stripped, so a pasted snippet cannot run on the public page.

**How the public pages read it**

- `js/branding.js` calls `public_info()` and `public_legal_page()` with the anon key and fills every
  `data-brand-*`, `data-contact-*`, `data-social-links` and `data-legal-*` element, in both languages.
- The landing page does the same through `src/app.js` (`loadBranding()` / `applyBranding()`), including
  the header logo, hero, about section, gallery (built from service images) and footer.
- If the database has no page content yet (for example, a freshly created project), the legal pages show
  a clear fallback message with the salon's contact details instead of an endless "loading" line.

**Per-client launch checklist**

1. Create a new Supabase project and run the current `schema.sql` in the SQL Editor (or use `install.html`).
2. Create the admin user and disable public sign-ups (see 3.2).
3. Write the connection file: run `install.html`, or copy this folder and run `npm run configure` to create `config.js` with that project's URL and publishable key.
4. Sign in → **Admin → Settings**: upload the logo, set name, phone, address, hours, map, email,
   social links, tagline, about text and SEO.
5. **Admin → Pages**: review/personalise the three legal pages (the schema seeds complete bilingual
   drafts) and replace `{phone}`/`{email}`/`{address}` values as needed.
6. Deploy only the front-end files listed in section 4, including `config.js`.

> `public_info` returns only the fields above. `public_services` returns service id, both names and the
> image URL (never prices), and `public_staff_list` returns active staff id and name only.

Service pictures live in `img/services/` and are matched by service name (`serviceImage()` in
`src/app.js`); the services editor only contains the Arabic name, English name and price.

### 3.8 One-click self-install (the product)

The customer never touches code. `install.html` walks through three screens:

1. **Salon data** — licence key, English slug, manager email/password, WhatsApp number.
2. **Accounts** — GitHub OAuth (repository + Pages) then Supabase OAuth (project + database), each on the
   customer's own account. No password or personal access token ever reaches the seller.
3. **Launch** — the page POSTs to the n8n webhook (`N8N_WEBHOOK_URL`) and shows the live booking and
   admin URLs plus the manager login.

The n8n workflow (`salon-full-auto-installer.json`) then:

1. validates the licence against the seller's master project (`salon_licenses`, `status = active`),
2. creates a **public repository from this template** in the customer's GitHub account,
3. deletes the template-only `CNAME` and `install.html` so the new site uses its own Pages URL,
4. creates a Supabase project in the customer's organization and waits until it is healthy,
5. runs `schema.sql` through the Management API,
6. creates the manager Auth user (the `auth.users` trigger fills `public.admins`),
7. pushes the generated `config.js` (URL + publishable key + salon name) to the repository,
8. enables GitHub Pages, sends the WhatsApp welcome message and marks the licence `used`.

The licence table lives in the seller's master project, never in a client project. Create it once with
`supabase/salon-licenses.sql`; it seeds `TEST-1234` for end-to-end testing.

> **The template repository must be public.** GitHub only lets an OAuth user generate a repository from a
> template they can read, and GitHub Free only serves Pages from public repositories. The site and its
> files are delivered to every visitor anyway; the paid value is the one-click install and the licence gate.

### 3.9 Seller checklist (once)

1. Create the master Supabase project and run `supabase/salon-licenses.sql`.
2. Make this repository **public** and mark it as a **Template repository** (Settings → Template
   repository). Keep the root `config.js` untracked and never commit a real project into it.
3. Import `salon-full-auto-installer.json` into n8n and fill its **Config Variables** node
   (`master_supabase_url`, `master_service_role_key`, GitHub/Supabase OAuth client IDs and secrets,
   template owner/repo, WhatsApp/Evolution keys).
4. Add **HTTP Basic Auth** credentials to the Supabase token node.
5. Activate the workflow and keep `https://n8n.awj-bh.cloud/webhook/salon-auto-install` reachable.
6. Fill the three constants at the top of `install.html` (`GITHUB_CLIENT_ID`, `SUPABASE_CLIENT_ID`,
   `N8N_WEBHOOK_URL`) and deploy it. Register the **exact** page URL as the OAuth callback in both the
   GitHub OAuth App and the Supabase OAuth App (`https://salon.awj-bh.com/install.html` for production).
7. Open `install.html` yourself and run it once with `TEST-1234`.

Nothing else is client-specific: the salon name, logo, contact details, social links, SEO text and the
three legal pages all live in the `settings` table and are edited from the dashboard. Every installation
has its own repository and its own Supabase project, so no data is ever shared.

The seller-side CLI (`npm run new-client` / `npm run apply-schema` / `npm run configure`) still exists as
a manual fallback; it now writes the root `config.js` instead of `js/config.js`.

### 3.10 Phones, tablets and the installable app

The same build is verified at every common viewport — 320, 360, 375, 390, 412, 414, 430 CSS px (phones),
768 and 820 (tablets), 1024, 1280, 1366, 1440 and 1920 (desktops), plus landscape phones — with **no
horizontal scrolling** on the landing page, the three legal pages, the booking form, the dashboard tabs or
the admin forms.

What is handled explicitly:

| Area | Behaviour |
| --- | --- |
| Narrow phones (≤ 360px) | Brand name wraps to two lines instead of being cut; the account button becomes an icon |
| Touch keyboards | Inputs are 16px on touch devices, so iOS Safari never zooms the page on focus |
| Tap targets | Language keys are at least 38×38px; buttons use the full `btn` padding |
| Landscape / short screens | Every dialog is capped at `100dvh − 2rem` and scrolls inside, so the close button is always reachable |
| Notched iPhones | `viewport-fit=cover` + `env(safe-area-inset-*)` keep the sticky header and footer clear of the notch |
| Installed app | `manifest.webmanifest` (standalone display, 192/512/maskable icons) and `sw.js` (offline shell, network-first updates) |

**Install it:** Android/Chrome → menu → *Install app* (or *Add to Home screen*); iPhone/Safari → Share →
*Add to Home Screen*. The home-screen icon uses `img/icon-*.png`; if a client uploads a logo, the in-page
favicon and the app title follow it automatically, while the launcher icon stays the packaged one.

`sw.js` never caches `config.js`, so a device can never keep talking to a swapped Supabase project, and
it serves the network version first — a new deployment appears on the next visit without clearing data.
When you change `sw.js` itself, bump the `CACHE` constant (`salon-shell-v3` → `v4`).

---


## 4. Deployment

### GitHub Pages (used by the installer)

`install.html` + n8n take care of this automatically. For a manual deployment:

1. Create the repository from this template (or push the front-end files to a new repository).
2. **Settings → Pages** → Source: **Deploy from a branch** → `main` / `/ (root)`.
3. Leave the default `https://<user>.github.io/<repo>/` URL, or add a custom domain and enable
   **Enforce HTTPS** (a `CNAME` file is created in the repository root).
4. Open the site; while `config.js` is missing it shows the activation banner with a link to `install.html`.

The repository must be **public** for two reasons: GitHub Free only serves Pages from public repositories,
and the installer's OAuth token can only generate a repository from a **public** template. The workflow
deletes the template-only `CNAME` and `install.html` from every generated repository, so each client site
is served from its own `/<repo>/` path and cannot claim `salon.awj-bh.com`.

The repository ships a `.nojekyll` file so GitHub Pages serves the files as-is (no Jekyll build step).

> **A Pages site built from `main` has no `config.js`** (it is git-ignored), so it shows the activation
> banner. That is correct for the template. To keep a working demo, publish it from a separate `demo`
> branch that adds `config.js` (never merge that commit into `main`), or upload the demo to Hostinger
> with `config.js`.

### Hostinger (alternative)

1. In hPanel, open **Files → File Manager → public_html**.
2. Upload `index.html`, `admin.html`, `privacy.html`, `terms.html`, `usage-policy.html`,
   `manifest.webmanifest`, `sw.js`, `config.js`, the `css` folder, the `js` folder, the `img` folder,
   `.htaccess` and `robots.txt`.
3. Enable **SSL** in hPanel and force HTTPS (the supplied `.htaccess` also redirects HTTP → HTTPS).
4. Open the domain, sign in as admin, and create your services and staff.

Upload **only** the files above. Do **not** upload `src/`, `supabase/`, `schema.sql`,
`salon-full-auto-installer.json`, `package.json`, `package-lock.json`, `tailwind.config.js`, `README.md`
or `node_modules/`. The supplied `.htaccess` already returns 404 for those paths as a second line of defence.

No Node.js, PHP, database or build step is required at runtime. The site is pure static hosting.

### Rebuilding after editing the source
Edit `src/app.js` / `src/i18n.js` (not the minified `js/*.min.js`), then:

```bash
npm install     # first time only
npm run build   # CSS + minified JS
```

Upload the regenerated `css/tailwind.css`, `js/app.min.js` and `js/i18n.min.js`.
Each `?v=` cache-bust hint is optional; `.htaccess` sends HTML and `config.js` with no-cache headers.

### Updating the Supabase keys
`config.js` is marked no-cache in `.htaccess`. After changing keys, hard-refresh the browser
(Ctrl+F5) or append `?v=2` to the URL.

---

## 5. WhatsApp booking alerts (Evolution API)

Alerts are sent **from PostgreSQL**, not from the browser. On every new booking two messages are sent:

1. **Official tax invoice to the client** — a bilingual (Arabic / English) formatted invoice with the
   invoice number, client, service, staff, appointment date, subtotal, VAT amount and rate, total, and
   the salon **VAT registration number**.
2. **New-booking alert to the admin** — the same details plus the invoice number.

### Invoice numbers
- Every booking gets an **official invoice number: 6 digits** (`000001`, `000002`, …).
- Numbers come from the `invoice_number_seq` sequence and are assigned by the database trigger, never
  by the client, enforced by a unique index — so they are **unique and strictly sequential**.
- A cancelled or deleted booking never frees its number for reuse (the sequence is never rewound).
- Above 999999 the number simply grows to 7 digits.
- Existing rows are numbered chronologically when the schema is (re)run.

Set **VAT Registration Number** in **Admin → Settings** (e.g. `BH123456789`) so it appears on the invoice.
Invoices can be re-sent any time: the receipt icon next to any appointment (admin table, today's list,
or staff **My Bookings**) opens a pre-filled WhatsApp message with that invoice.

1. In **Admin → Settings**, fill in:
   - **Admin WhatsApp Number** in international format without `+`, e.g. `97333123456`
   - **Evolution API Server URL**, e.g. `https://evolution.yourdomain.com`
   - **Evolution API Key**
   - **Evolution Instance Name**
2. Save settings, then use **Test WhatsApp** in the same card: enter a phone number and press
   **Send Test**. After a few seconds **Recent sends** shows the HTTP status (200 = sent).
3. New bookings insert into `appointments` and the `trg_notify_new_appointment` trigger calls:

```http
POST {EVOLUTION_URL}/message/sendText/{INSTANCE}
apikey: {EVOLUTION_API_KEY}
{
  "number": "97333123456",
  "text": "📅 New Booking ..."
}
```

The HTTP call is made with the `pg_net` extension. The trigger is fault-tolerant: if the settings
are blank or the API is unreachable, the booking is still saved.

Phone numbers are normalized automatically: Arabic-Indic digits are converted, `00`/`+` and a national
trunk `0` are stripped, and 8-digit Bahraini numbers get the `973` prefix. A message that cannot be
sent is logged with its reason (`SKIPPED: …`), so nothing fails silently.

> The Evolution API key is protected by RLS. It is only readable by authenticated admin users.

**Troubleshooting:**
- `Test WhatsApp` says settings are incomplete → fill URL, key and instance and save first.
- Recent sends shows **Failed** or a non-200 code → check the Evolution server, instance name and key.
  The response body is shown under the log.
- If no message arrives but the status is 200, verify the number is connected to WhatsApp in Evolution
  and that the instance is not paused.

**Manual fallback:** after a successful booking the success card offers **Send invoice to client**
(pre-filled official invoice) and **Notify admin** (short alert), both opening WhatsApp.

### Google Sheets backup (bookings + expenses)
Every booking, status change and expense can also be written to a Google Sheet in real time. The
request is sent by PostgreSQL through `pg_net`, so no Google credentials ever reach the browser and
there is no CORS problem. Bookings go to the `Bookings` tab and expenses to the `Expenses` tab.

1. Create a Google Sheet, then open **Extensions → Apps Script**.
2. In **Admin → Settings → Google Sheets**, press **Copy Apps Script code** and paste it into the
   Apps Script editor. Save the project.
3. **Deploy → New deployment → Web app** with **Execute as: Me** and **Who has access: Anyone**.
4. Copy the deployment URL ending in `/exec`, paste it into the settings field and save.
5. Press **Send test row**, then check **Recent sync log** and the sheet's `Bookings` tab.

`admin_sync_all_to_sheet()` re-sends up to 1000 recent bookings and 1000 recent expenses if the sheet
was connected late. The log shows `Sent`, `Sending`, `Failed` or `Not sent` (`SKIPPED: …` explains
why, e.g. URL unset). Because the call originates in Supabase's cloud, the URL must be public HTTPS;
`localhost` will not work.

---

## 6. VAT accounting notes

- Default rate is **10%**; change it in **Admin → Settings**. Use `0` if the salon is not VAT-registered.
- **Prices include VAT** is enabled by default, which suits Bahrain retail pricing.
  - Inclusive: `VAT = Gross − (Gross ÷ 1.10)`
  - Exclusive: `VAT = Net × 0.10`
- The VAT report uses **completed services** by default. Switch the sales basis to **all non-cancelled
  bookings** if your accountant requires cash/booking-basis reporting.
- Enter the **VAT Registration No.** in settings to print it on the NBR summary.
- Expenses can store input VAT (supplier VAT number, invoice number and VAT amount). The VAT report
  shows input VAT and `Net VAT due = output VAT − input VAT`; a negative result is a credit carried forward.
- The report is a summary, not a tax submission. Verify figures with your accountant before filing.

---

## 7. Daily usage

1. **POS & Bookings** — create the appointment, select service + staff, enter the BenefitPay reference,
   confirm. Commission is calculated and stored automatically.
2. **Today's Appointments** (admin) — mark a service **completed** when the client is served, or **cancelled**
   if they do not arrive. Only completed services count toward performance reports by default.
3. **Reports** — pick a period and daily/monthly grouping, then review revenue, commissions, expenses
   and net profit.
4. **Expenses** — open **Expenses** (admin or staff) and add each purchase: title, amount, payment
   method (Cash / BenefitPay), date and optional notes. Admin sees all expenses and totals; staff can
   only enter an expense and never see the records. Totals and net profit feed the reports automatically.
5. **VAT** — select the filing month or a custom range, review the totals, then print or export CSV.
6. **Admin** — keep services, prices, staff rates, staff logins and settings current.
7. **Staff** — sign in with username + password + access code, then view **My Bookings**, record
   **Expenses** and mark her own appointments completed or cancelled. Commission figures, reports,
   other staff expenses and settings stay admin-only.

---

## 8. Database reference

| Table | Purpose |
|---|---|
| `services` | Bilingual name, price `numeric(10,3)`, `image_url`, `is_active` |
| `staff` | Name, phone, `commission_rate` 0–100, `is_active`, `username`, `password_hash`, `login_enabled` |
| `appointments` | `invoice_no` (6-digit sequential), client, service, staff, datetime, payment ref, status, total, commission |
| `invoice_number_seq` | Sequence that issues invoice numbers; never rewound |
| `settings` | Key/value store: salon identity (name, logo, tagline, photos, about), contact details, social links, SEO, legal pages, VAT, WhatsApp, Evolution API, Google Sheet URL, staff access code hash |
| `staff_sessions` | Short-lived staff tokens (12 hours), never exposed through the API |
| `whatsapp_log` | Outbound message log for the admin diagnostics panel |
| `sheets_log` | Google Sheets sync attempts and pg_net request ids |
| `expenses` | Title, amount `numeric(10,3)`, method (`cash` / `benefitpay`), notes, `vendor_name`, `vendor_vat_no`, `invoice_no`, `vat_amount`, `staff_id`, `created_by`, `spent_at` |

`appointments.status` is one of `pending`, `completed`, `cancelled`.

The trigger `set_appointment_totals` always overwrites `total_price` and `commission_amount` from the
current service price and staff rate, and forces new bookings to `pending`. This prevents a public
client from submitting a fake price or a pre-completed booking. `public_booking` additionally
validates the service/staff, normalizes the phone, applies the booking limits and returns only the
new invoice number. The `sync_appointment_sheet` trigger queues the booking row, and
`sync_expense_sheet` queues each expense to the `Expenses` tab.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Yellow “Setup required” banner | Create `config.js` with the real URL and publishable key (`npm run configure`, or open `install.html`) |
| “Invalid login credentials” | Create/confirm the user in Supabase Auth; check the email and password |
| No services or staff in POS | Run `seed.sql`, or add records in **Admin**; check that they are **Active** |
| Booking fails | Check the browser console/network tab; verify RLS policies were created by `schema.sql` |
| Booking says the database is outdated | Run the latest `schema.sql` — `public_booking` and `public_info` must exist |
| Landing page shows no services | Run `schema.sql`, add active services and staff, then reload; pictures fall back to `img/services/nails.jpg` |
| Google Sheet says “Not sent” | Set the Apps Script `/exec` URL in Settings, save, then use **Send test row** |
| Google Sheet shows **Failed** | Re-deploy the Apps Script as a Web App with access **Anyone** and copy the new `/exec` URL |
| `column ... does not exist` while running SQL | An older table already exists. Re-run the latest `schema.sql` — it adds missing `is_active`, `created_at`, `phone`, `notes` and `updated_at` columns automatically. If that still fails, drop the four tables and re-run the schema (see README). |
| WhatsApp alert not received | Check the four Evolution settings and the instance connection state. In the SQL Editor run `select * from net._http_response order by created desc limit 10;` to inspect pg_net delivery errors. |
| Reports show no data | Only **completed** services count; change the appointment status or the VAT basis |
| Expenses page says the table is missing | Run the latest `schema.sql` — it creates `expenses` plus the `staff_expenses`, `staff_create_expense` and `staff_delete_expense` RPCs |
| Staff cannot see the expenses list | By design: staff can add an expense but never view, total or delete expense records; only the admin can. Re-run the latest `schema.sql` to apply the revoked read/delete RPCs. |
| Expenses tab is missing in Google Sheets | Re-copy the Apps Script code from Settings (the old version wrote bookings only) and re-deploy the Web App |
| Charts do not render | Ensure `cdn.jsdelivr.net` is reachable; a strict corporate firewall may block it |
| Dates look shifted | The app displays and groups in Asia/Bahrain; ensure the device clock is correct |

---

## 10. Backups & maintenance

- Supabase **Database → Backups** provides daily backups on paid plans; export regularly from the dashboard.
- Rotate the Supabase anon key and Evolution API key if a device is lost.
- Review staff commission rates whenever prices change; existing appointment records keep the commission
  calculated at booking time.
- To revoke an admin, delete the user in **Authentication → Users**.

---

© Glow Beauty Lounge. Built with Supabase, Alpine.js and Chart.js.
