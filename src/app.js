// ---------------------------------------------------------------------------
// Connection settings.
//
// The installer (install.html → n8n) writes ./config.js with window.APP_CONFIG
// for every salon, so this file never contains a project URL or key. If the
// placeholders are still there the app renders an "activate me" notice that
// links to install.html instead of failing silently.
// ---------------------------------------------------------------------------
const APP_CONFIG = window.APP_CONFIG || {}

const isPlaceholder = (value) => {
  const v = String(value == null ? '' : value).trim()
  return !v || v === '%%SUPABASE_URL%%' || v === '%%SUPABASE_ANON_KEY%%' ||
    v === '%%SALON_NAME%%' || v.includes('YOUR-')
}

const appConfigName = (() => {
  const name = String(APP_CONFIG.SALON_NAME == null ? '' : APP_CONFIG.SALON_NAME).trim()
  return isPlaceholder(name) ? '' : name
})()

const isConfigured = () => Boolean(
  window.supabase &&
  !isPlaceholder(APP_CONFIG.SUPABASE_URL) &&
  !isPlaceholder(APP_CONFIG.SUPABASE_ANON_KEY)
)

const sb = isConfigured()
  ? window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY)
  : null

const CHART_COLORS = ['#db2777', '#f472b6', '#fb7185', '#a855f7', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b']

document.addEventListener('alpine:init', () => {
  Alpine.data('salonApp', () => ({
    lang: 'ar',
    tab: 'pos',
    adminTab: 'services',
    user: null,
    authChecked: false,
    brandName: '',
    toast: { show: false, type: 'success', msg: '' },
    toastTimer: null,
    services: [],
    staff: [],
    settings: {},
    pos: { client_name: '', client_phone: '', service_id: '', staff_id: '', appointment_date: '', payment_proof: '', notes: '' },
    submitting: false,
    lastBooking: null,
    todaysAppts: [],
    todayLoading: false,
    email: '',
    password: '',
    loginOpen: false,
    entryIntent: '',
    loggingIn: false,
    loginError: '',
    svcModal: false,
    svcSaving: false,
    svcForm: { id: null, name_ar: '', name_en: '', price: '', is_active: true },
    stfModal: false,
    stfSaving: false,
    stfForm: { id: null, name: '', phone: '', commission_rate: 10 },
    showKey: false,
    apptFilter: { status: 'all', from: '', to: '' },
    apptSearch: '',
    appts: [],
    apptsLoading: false,
    report: { from: '', to: '', interval: 'daily' },
    reportLoading: false,
    reportRows: [],
    reportData: null,
    charts: {},
    vatMonth: '',
    vat: { from: '', to: '', basis: 'completed' },
    vatLoading: false,
    vatResult: null,
    settingsSaving: false,
    pagesSaving: false,
    pageTab: 'privacy',
    pageDefs: [
      { slug: 'privacy', file: 'privacy.html' },
      { slug: 'terms', file: 'terms.html' },
      { slug: 'usage', file: 'usage-policy.html' }
    ],
    logoUploading: false,
    confirmBox: { open: false, msg: '', resolve: null },

    // ---- Public landing page (no login required) ----
    publicInfo: {},
    publicServices: [],
    publicStaff: [],
    publicBooking: { client_name: '', client_phone: '', service_id: '', staff_id: '', appointment_date: '', notes: '', consent: false },
    publicSubmitting: false,
    publicDone: null,
    publicFormError: '',
    entryOpen: false,

    // ---- Google Sheets ----
    sheetTesting: false,
    sheetSyncing: false,
    sheetLog: [],
    sheetLogLoading: false,

    // ---- Expenses ----
    expenses: [],
    expensesLoading: false,
    expenseSaving: false,
    expenseForm: { title: '', amount: '', method: 'cash', notes: '', spent_at: '', vendor_name: '', vendor_vat_no: '', invoice_no: '', vat_amount: '' },
    expenseFilter: { from: '', to: '' },
    expenseTotals: { count: 0, total: 0, cash: 0, benefitpay: 0, vat: 0 },
    reportExpenses: [],

    // ---- Staff access (custom username/password + shared app code) ----
    staffSession: null,
    staffLoginOpen: false,
    staffForm: { username: '', password: '', code: '' },
    staffLoginError: '',
    staffLoggingIn: false,
    staffBookings: [],
    staffBookingsLoading: false,
    staffCodeSet: false,
    newStaffCode: '',
    staffCodeSaving: false,

    // ---- WhatsApp diagnostics ----
    waTestPhone: '',
    waTesting: false,
    waLog: [],
    waLogLoading: false,

    get configured() {
      return isConfigured()
    },
    get isAdmin() {
      return Boolean(this.user)
    },
    get isStaff() {
      return Boolean(this.staffSession)
    },
    get canAccess() {
      // Nothing renders until the session check finishes, and only a verified
      // admin or staff session unlocks the app.
      return this.authChecked && (Boolean(this.user) || Boolean(this.staffSession))
    },
    get salonName() {
      return this.publicInfo.salon_name || this.settings.salon_name || this.brandName || appConfigName || this.t('app_title')
    },
    get brandLogo() {
      return this.publicInfo.logo_url || this.settings.logo_url || ''
    },
    get brandTagline() {
      const value = this.lang === 'ar'
        ? (this.publicInfo.tagline_ar || this.settings.brand_tagline_ar)
        : (this.publicInfo.tagline_en || this.settings.brand_tagline_en)
      return value || this.t('footer_tagline')
    },
    get aboutText() {
      const value = this.lang === 'ar'
        ? (this.publicInfo.about_ar || this.settings.about_text_ar)
        : (this.publicInfo.about_en || this.settings.about_text_en)
      return value || this.t('landing_about_text')
    },
    get heroImage() {
      return this.publicInfo.hero_image_url || this.settings.hero_image_url || 'img/services/hero.jpg'
    },
    get aboutImage() {
      return this.publicInfo.about_image_url || this.settings.about_image_url || 'img/services/about.jpg'
    },
    socialUrl(key, value) {
      const v = String(value == null ? '' : value).trim()
      if (!v) return ''
      if (key === 'social_whatsapp' && /^[+\d\s()-]+$/.test(v)) {
        return 'https://wa.me/' + v.replace(/\D/g, '')
      }
      return /^https?:\/\//i.test(v) ? v : 'https://' + v.replace(/^\/+/, '')
    },
    get socialLinks() {
      const defs = [
        { key: 'social_whatsapp', label: this.t('contact_whatsapp'), icon: 'i-whatsapp' },
        { key: 'social_instagram', label: 'Instagram', icon: 'i-instagram' },
        { key: 'social_tiktok', label: 'TikTok', icon: 'i-tiktok' },
        { key: 'social_snapchat', label: 'Snapchat', icon: 'i-snapchat' },
        { key: 'social_facebook', label: 'Facebook', icon: 'i-facebook' },
        { key: 'social_x', label: 'X', icon: 'i-x-social' },
        { key: 'social_youtube', label: 'YouTube', icon: 'i-youtube' }
      ]
      return defs
        .map(d => ({ ...d, url: this.socialUrl(d.key, this.publicInfo[d.key] || this.settings[d.key]) }))
        .filter(d => d.url)
    },
    get galleryImages() {
      const fromServices = this.publicServices
        .filter(s => s.image_url)
        .slice(0, 4)
        .map(s => ({ src: s.image_url, alt: this.publicServiceName(s) }))
      if (fromServices.length) return fromServices
      return ['manicure', 'lashes', 'hair', 'nails']
        .map(name => ({ src: 'img/services/' + name + '.jpg', alt: this.salonName }))
    },
    get bookingService() {
      return this.publicServices.find(s => s.id === this.publicBooking.service_id) || null
    },
    get bookingStaff() {
      return this.publicStaff.find(s => s.id === this.publicBooking.staff_id) || null
    },
    get mapEmbedUrl() {
      const q = [this.publicInfo.salon_name || this.settings.salon_name, this.publicInfo.salon_address || this.settings.salon_address]
        .filter(Boolean).join(' ')
      return 'https://www.google.com/maps?q=' + encodeURIComponent(q || 'salon') + '&output=embed'
    },
    get publicMinDate() {
      return this.localInputStr(new Date(Date.now() + 15 * 60 * 1000))
    },
    get activeServices() {
      return this.services.filter(s => s.is_active !== false)
    },
    get activeStaff() {
      return this.staff.filter(s => s.is_active !== false)
    },
    get selectedService() {
      return this.services.find(s => s.id === this.pos.service_id) || null
    },
    get selectedStaff() {
      return this.staff.find(s => s.id === this.pos.staff_id) || null
    },
    get posTotal() {
      return this.selectedService ? Number(this.selectedService.price) : 0
    },
    get posCommission() {
      // Commission figures are admin-only.
      if (!this.user) return 0
      const st = this.selectedStaff
      if (!st || st.commission_rate == null) return 0
      return Math.round(this.posTotal * Number(st.commission_rate) / 100 * 1000) / 1000
    },
    get posVat() {
      const total = this.posTotal
      if (!total) return 0
      const rate = Math.max(0, parseFloat(this.settings.vat_rate || '10')) / 100
      const value = this.settings.vat_inclusive !== 'false'
        ? total - total / (1 + rate)
        : total * rate
      return Math.round(value * 1000) / 1000
    },
    get filteredAppts() {
      const s = (this.apptSearch || '').trim().toLowerCase()
      if (!s) return this.appts
      return this.appts.filter(a =>
        (a.client_name || '').toLowerCase().includes(s) ||
        (a.client_phone || '').includes(s)
      )
    },

    init() {
      this.lang = localStorage.getItem('salon_lang') || 'ar'
      this.applyDir()
      this.resetPublicBooking()
      // admin.html (the link the installer shows) lands on index.html?entry=admin
      // and should open the manager login immediately.
      this.entryIntent = new URLSearchParams(location.search).get('entry') || ''
      if (!sb) {
        this.authChecked = true
        if (this.entryIntent) this.loginOpen = true
        this.entryIntent = ''
        return
      }
      this.setDefaultDates()
      this.setDefaultExpenseDate()
      sb.auth.onAuthStateChange((_event, session) => {
        const wasUser = Boolean(this.user)
        this.user = session ? session.user : null
        // Keep Supabase queries out of the auth callback lock.
        if (this.user) {
          this.clearStaffSession()
          this.authChecked = true
          setTimeout(() => this.refreshAfterAuth(), 0)
        } else if (wasUser) {
          this.authChecked = true
          setTimeout(() => {
            this.clearAdminData()
            this.tab = 'pos'
          }, 0)
        }
      })
      this.bootstrapAuth()
    },

    // Public contact details for the landing page. Only these fields are
    // public; prices, staff phones and the access code stay private.
    async loadBranding() {
      try {
        const { data, error } = await sb.rpc('public_info')
        if (!error && data && data.length) {
          this.publicInfo = data[0]
          if (data[0].salon_name) this.brandName = data[0].salon_name
          this.applyBranding()
          return
        }
        // Older database that has not run the latest schema yet.
        const { data: old } = await sb.rpc('public_branding')
        if (old && old.length && old[0].salon_name) {
          this.brandName = old[0].salon_name
          this.publicInfo = { salon_name: old[0].salon_name }
          this.applyBranding()
        }
      } catch (_e) { /* branding is optional */ }
    },

    // Keep the document title, social preview tags, favicon and structured
    // data in sync with whatever is configured in the admin dashboard.
    applyBranding() {
      const info = this.publicInfo || {}
      const ar = this.lang === 'ar'
      const name = info.salon_name || this.settings.salon_name || this.brandName || appConfigName || ''
      const seoTitle = ar ? info.seo_title_ar : info.seo_title_en
      const seoDesc = ar ? info.seo_description_ar : info.seo_description_en
      const description = seoDesc || (ar ? info.about_ar : info.about_en) || this.t('meta_description')
      const image = info.logo_url || info.hero_image_url || 'img/og-cover.jpg'

      document.title = seoTitle || (name ? name + ' · ' + this.t('site_title_suffix') : this.t('site_title_suffix'))

      const set = (id, attr, value) => {
        const el = document.getElementById(id)
        if (el && value) el.setAttribute(attr, value)
      }
      set('meta-description', 'content', description)
      set('meta-author', 'content', name)
      set('og-site-name', 'content', name)
      set('og-title', 'content', document.title)
      set('og-description', 'content', description)
      set('og-image', 'content', image)
      set('twitter-title', 'content', document.title)
      set('twitter-description', 'content', description)
      set('twitter-image', 'content', image)
      set('favicon', 'href', info.logo_url)
      set('app-name', 'content', name)
      set('apple-app-title', 'content', name)
      set('apple-touch-icon', 'href', info.logo_url)

      const ld = {
        '@context': 'https://schema.org',
        '@type': 'BeautySalon',
        name: name || undefined,
        description,
        image,
        url: window.location.origin + window.location.pathname,
        telephone: info.salon_phone || undefined,
        email: info.salon_email || undefined,
        address: info.salon_address
          ? { '@type': 'PostalAddress', streetAddress: info.salon_address, addressCountry: 'BH' }
          : undefined,
        hasMap: info.map_url || undefined,
        sameAs: this.socialLinks.map(s => s.url)
      }
      const script = document.getElementById('ld-json')
      if (script) script.textContent = JSON.stringify(ld)
    },

    async loadPublicData() {
      if (!sb) return
      try {
        const [svc, stf] = await Promise.all([
          sb.rpc('public_services'),
          sb.rpc('public_staff_list')
        ])
        if (!svc.error) this.publicServices = svc.data || []
        if (!stf.error) this.publicStaff = stf.data || []
      } catch (_e) { /* the landing page still works without data */ }
    },

    resetPublicBooking() {
      const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
      d.setMinutes(0, 0, 0)
      this.publicBooking = {
        client_name: '',
        client_phone: '',
        service_id: '',
        staff_id: '',
        appointment_date: this.localInputStr(d),
        notes: '',
        consent: false
      }
      this.publicFormError = ''
    },

    // Resolve the admin session and validate any saved staff token before the
    // app is allowed to render.
    async bootstrapAuth() {
      try {
        const { data } = await sb.auth.getSession()
        this.user = data && data.session ? data.session.user : null
      } catch (_e) {
        this.user = null
      }

      if (this.user) {
        this.clearStaffSession()
        this.authChecked = true
        this.refreshAfterAuth()
        if (this.entryIntent === 'admin') this.tab = 'admin'
        this.entryIntent = ''
        return
      }

      await Promise.all([this.loadBranding(), this.restoreStaffSession()])
      this.authChecked = true
      if (!this.user && !this.staffSession) {
        if (this.entryIntent) this.loginOpen = true
        this.entryIntent = ''
        this.loadPublicData()
        return
      }
      this.loadBase()
      if (this.staffSession) this.loadStaffBookings()
    },

    applyDir() {
      document.documentElement.lang = this.lang
      document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr'
    },
    setLang(l) {
      this.lang = l
      localStorage.setItem('salon_lang', l)
      this.applyDir()
      if (this.publicInfo && Object.keys(this.publicInfo).length) this.applyBranding()
      if (this.reportData && this.tab === 'reports') this.$nextTick(() => this.renderCharts())
    },
    t(k) {
      const d = window.I18N || {}
      return (d[this.lang] && d[this.lang][k]) || (d.en && d.en[k]) || k
    },

    pad2(n) { return String(n).padStart(2, '0') },
    localDateStr(d) { return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}` },
    localInputStr(d) {
      const p = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bahrain', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(d).reduce((acc, part) => { acc[part.type] = part.value; return acc }, {})
      return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`
    },
    // datetime-local values represent salon wall-clock time (Bahrain, UTC+3).
    toSalonISO(value) {
      if (!value) return null
      return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value + ':00+03:00' : value).toISOString()
    },
    setDefaultDates() {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth()
      this.report.from = this.localDateStr(new Date(y, m, 1))
      this.report.to = this.localDateStr(now)
      this.vatMonth = `${y}-${this.pad2(m + 1)}`
      this.vat.from = this.localDateStr(new Date(y, m, 1))
      this.vat.to = this.localDateStr(new Date(y, m + 1, 0))
      const d = new Date()
      d.setMinutes(0, 0, 0)
      d.setHours(d.getHours() + 1)
      this.pos.appointment_date = this.localInputStr(d)
    },
    setDefaultExpenseDate() {
      const d = new Date()
      this.expenseForm.spent_at = this.localDateStr(d)
      if (!this.expenseFilter.from) this.expenseFilter.from = this.localDateStr(new Date(d.getFullYear(), d.getMonth(), 1))
      if (!this.expenseFilter.to) this.expenseFilter.to = this.localDateStr(d)
    },
    fmtBHD(n) {
      return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' ' + this.t('currency')
    },
    esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[ch]))
    },
    csvCell(value) {
      let s = String(value == null ? '' : value)
      // Prevent spreadsheet formula injection.
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
      return '"' + s.replace(/"/g, '""') + '"'
    },
    fmtDateTime(iso) {
      return new Date(iso).toLocaleString(this.lang === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bahrain' })
    },
    fmtDate(iso) {
      return new Date(iso).toLocaleDateString(this.lang === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeZone: 'Asia/Bahrain' })
    },
    fmtTime(iso) {
      return new Date(iso).toLocaleTimeString(this.lang === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB', { timeStyle: 'short', timeZone: 'Asia/Bahrain' })
    },
    fmtDay(dayStr) {
      return new Date(dayStr + 'T12:00:00+03:00').toLocaleDateString(this.lang === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Bahrain' })
    },
    fmtMonth(ym) {
      return new Date(ym + '-01T12:00:00+03:00').toLocaleDateString(this.lang === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Bahrain' })
    },
    // Calendar date (YYYY-MM-DD) in the salon's timezone (Bahrain, UTC+3, no DST).
    bhDay(iso) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Bahrain', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date(iso)).reduce((acc, p) => { acc[p.type] = p.value; return acc }, {})
      return `${parts.year}-${parts.month}-${parts.day}`
    },

    showToast(type, msg) {
      this.toast = { show: true, type, msg }
      clearTimeout(this.toastTimer)
      this.toastTimer = setTimeout(() => { this.toast.show = false }, 4000)
    },
    askConfirm(msg) {
      return new Promise(resolve => {
        this.confirmBox = { open: true, msg, resolve }
      })
    },
    confirmYes() {
      this.confirmBox.open = false
      if (this.confirmBox.resolve) this.confirmBox.resolve(true)
    },
    confirmNo() {
      this.confirmBox.open = false
      if (this.confirmBox.resolve) this.confirmBox.resolve(false)
    },

    switchTab(t) {
      if (['reports', 'vat', 'admin'].includes(t) && !this.user) {
        this.loginOpen = true
        return
      }
      if (t === 'expenses' && !this.user && !this.staffSession) {
        this.staffLoginOpen = true
        return
      }
      if (t === 'mybookings' && !this.staffSession) {
        this.staffLoginOpen = true
        return
      }
      this.tab = t
      this.loginError = ''
      if (t === 'pos' && this.user && !this.todaysAppts.length) this.loadToday()
      if (t === 'expenses' && this.user) this.loadExpenses()
      if (t === 'reports' && this.user) {
        if (this.reportData) this.$nextTick(() => this.renderCharts())
        else if (!this.reportLoading) this.runReport()
      }
      if (t === 'vat' && this.user && !this.vatResult && !this.vatLoading) this.runVat()
      if (t === 'admin' && this.user && !this.appts.length && !this.apptsLoading) this.loadAppts()
      if (t === 'mybookings' && this.staffSession && !this.staffBookings.length && !this.staffBookingsLoading) this.loadStaffBookings()
    },

    async loadBase() {
      this.loadServices()
      this.loadStaff()
      this.loadSettings()
    },
    async loadServices() {
      if (!sb) return
      if (this.user) {
        const { data, error } = await sb.from('services').select('*').order('created_at', { ascending: true })
        if (!error) this.services = data || []
        return
      }
      if (this.staffSession) {
        const { data, error } = await sb.rpc('staff_services', { p_token: this.staffSession.token })
        if (error) return
        this.services = data || []
        return
      }
      this.services = []
    },
    async loadStaff() {
      if (!sb) return
      if (this.user) {
        // Admin only: explicit columns (never fetch password_hash).
        const { data, error } = await sb.from('staff')
          .select('id,name,phone,commission_rate,is_active,created_at,username,login_enabled')
          .order('created_at', { ascending: true })
        if (!error) this.staff = data || []
        return
      }
      if (this.staffSession) {
        // Staff sessions only receive names (no phone/commission/username).
        const { data, error } = await sb.rpc('staff_list', { p_token: this.staffSession.token })
        if (error) return
        this.staff = data || []
        return
      }
      this.staff = []
    },
    async loadSettings() {
      if (!sb) return
      if (this.user) {
        const { data, error } = await sb.from('settings').select('*')
        if (error) return
        const map = {}
        ;(data || []).forEach(r => { map[r.setting_key] = r.setting_value })
        // The staff access code is write-only: never keep its hash in UI state.
        this.staffCodeSet = Boolean(map.staff_app_code_hash)
        delete map.staff_app_code_hash
        this.settings = map
        return
      }
      if (this.staffSession) {
        // Safe public settings only (no WhatsApp keys or access-code hash).
        this.staffCodeSet = false
        const { data, error } = await sb.rpc('staff_settings', { p_token: this.staffSession.token })
        if (error || !data || !data.length) return
        const row = data[0]
        this.settings = {
          salon_name: row.salon_name || '',
          vat_rate: row.vat_rate || '10',
          vat_inclusive: row.vat_inclusive || 'true',
          vat_number: row.vat_number || ''
        }
        return
      }
      this.staffCodeSet = false
      this.settings = {}
    },

    async signIn() {
      // Without a configured client there is nothing to authenticate against,
      // so say it instead of leaving the button looking dead.
      if (!sb) {
        this.loginError = this.t('setup_required_login')
        return
      }
      this.loggingIn = true
      this.loginError = ''
      const { error } = await sb.auth.signInWithPassword({ email: this.email, password: this.password })
      this.loggingIn = false
      if (error) {
        this.loginError = this.t('login_error')
        return
      }
      this.loginOpen = false
      this.email = ''
      this.password = ''
    },
    async signOut() {
      if (!sb) return
      await sb.auth.signOut()
      this.tab = 'pos'
      this.loadPublicData()
    },

    // ---------------- Staff session ----------------
    async restoreStaffSession() {
      let saved = null
      try {
        const raw = localStorage.getItem('salon_staff_session')
        saved = raw ? JSON.parse(raw) : null
      } catch (_e) {
        saved = null
      }
      if (!saved || !saved.token) {
        this.clearStaffSession()
        return
      }
      try {
        const { data, error } = await sb.rpc('staff_me', { p_token: saved.token })
        if (error || !data || !data.length) {
          this.clearStaffSession()
          return
        }
        this.staffSession = {
          token: saved.token,
          staff_id: data[0].staff_id,
          name: data[0].name
        }
        this.persistStaffSession()
      } catch (_e) {
        this.clearStaffSession()
      }
    },
    persistStaffSession() {
      if (this.staffSession) {
        localStorage.setItem('salon_staff_session', JSON.stringify(this.staffSession))
      }
    },
    clearStaffSession() {
      this.staffSession = null
      this.staffBookings = []
      this.expenses = []
      this.buildExpenseTotals()
      localStorage.removeItem('salon_staff_session')
    },
    openStaffLogin() {
      this.staffForm = { username: '', password: '', code: '' }
      this.staffLoginError = ''
      this.staffLoginOpen = true
    },
    async staffSignIn() {
      if (!sb) return
      const f = this.staffForm
      if (!f.username.trim() || !f.password || !f.code.trim()) {
        this.staffLoginError = this.t('err_required')
        return
      }
      this.staffLoggingIn = true
      this.staffLoginError = ''
      const { data, error } = await sb.rpc('staff_login', {
        p_username: f.username.trim(),
        p_password: f.password,
        p_app_code: f.code.trim()
      })
      this.staffLoggingIn = false
      if (error || !data || !data.length) {
        const msg = String((error && error.message) || '')
        if (msg.includes('too_many_attempts')) this.staffLoginError = this.t('staff_too_many')
        else if (msg.includes('code_not_set')) this.staffLoginError = this.t('staff_code_not_set')
        else if (msg.includes('invalid_code')) this.staffLoginError = this.t('staff_bad_code')
        else if (msg.includes('invalid_credentials')) this.staffLoginError = this.t('staff_bad_credentials')
        else this.staffLoginError = this.t('error_generic')
        return
      }
      const row = data[0]
      this.staffSession = { token: row.token, staff_id: row.staff_id, name: row.name }
      this.persistStaffSession()
      this.staffForm = { username: '', password: '', code: '' }
      this.staffLoginOpen = false
      this.showToast('success', this.t('staff_welcome').replace('{name}', row.name))
      this.tab = 'mybookings'
      this.loadBase()
      this.loadStaffBookings()
    },
    async staffSignOut() {
      if (sb && this.staffSession) {
        try { await sb.rpc('staff_logout', { p_token: this.staffSession.token }) } catch (_e) { /* ignore */ }
      }
      this.clearStaffSession()
      this.tab = 'pos'
      this.loadBase()
      this.loadPublicData()
    },
    staffServiceName(a) {
      return (this.lang === 'ar' ? a.service_ar : a.service_en) || a.service_en || a.service_ar || '—'
    },
    async loadStaffBookings() {
      if (!sb || !this.staffSession) return
      this.staffBookingsLoading = true
      const { data, error } = await sb.rpc('staff_appointments', { p_token: this.staffSession.token })
      this.staffBookingsLoading = false
      if (error) {
        if (String(error.message || '').includes('invalid_session')) {
          this.clearStaffSession()
          this.staffLoginOpen = true
        } else {
          this.showToast('error', this.t('error_generic'))
        }
        return
      }
      this.staffBookings = data || []
    },
    async setStaffBookingStatus(a, status) {
      if (!sb || !this.staffSession) return
      const { error } = await sb.rpc('staff_set_appointment_status', {
        p_token: this.staffSession.token,
        p_appointment_id: a.id,
        p_status: status
      })
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      a.status = status
      this.showToast('success', this.t('staff_booking_updated'))
    },
    refreshAfterAuth() {
      if (this.user) this.clearStaffSession()
      this.loadBase()
      this.loadToday()
      this.loadAppts()
      // The admin shell shows the same public identity as the landing page, so
      // load it here too; otherwise SEO/tagline/social stay stale after login.
      this.loadBranding()
      if (this.tab === 'reports' && !this.reportData) this.runReport()
      if (this.tab === 'vat' && !this.vatResult) this.runVat()
    },
    clearAdminData() {
      this.appts = []
      this.todaysAppts = []
      this.reportRows = []
      this.reportData = null
      this.reportExpenses = []
      this.expenses = []
      this.buildExpenseTotals()
      this.vatResult = null
      this.waLog = []
      this.sheetLog = []
      this.staffCodeSet = false
      this.loadBase()
      this.loadPublicData()
      this.loadBranding()
    },

    svcName(s) {
      return (this.lang === 'ar' ? s.name_ar : s.name_en) || s.name_en || s.name_ar || '—'
    },
    publicServiceName(s) {
      if (!s) return '—'
      return (this.lang === 'ar' ? s.name_ar : s.name_en) || s.name_en || s.name_ar || '—'
    },
    serviceOptionLabel(s) {
      return `${this.svcName(s)} · ${this.fmtBHD(s.price)}`
    },
    // Pictures are local and automatic; the services editor only edits names
    // and price, as requested. A service can still override image_url in the DB.
    serviceImage(s) {
      if (s && s.image_url) return s.image_url
      const n = ((s && ((s.name_en || '') + ' ' + (s.name_ar || ''))) || '').toLowerCase()
      const rules = [
        [/gel|acrylic|nail|manicure|أظافر|اظافر|مانيكير|جل|اكريليك/, 'img/services/manicure.jpg'],
        [/pedicure|باديكير/, 'img/services/pedicure.jpg'],
        [/lash|eyelash|رموش/, 'img/services/lashes.jpg'],
        [/brow|thread|حواجب|حاجب/, 'img/services/brows.jpg'],
        [/bridal|wedding|عروس|زفاف/, 'img/services/bridal.jpg'],
        [/makeup|make-up|مكياج|ميكاب/, 'img/services/makeup.jpg'],
        [/hair spa|hair wash|keratin|حمام كريمي|بروتين/, 'img/services/hairwash.jpg'],
        [/facial|skin|clean|بشرة|تنظيف/, 'img/services/facial.jpg'],
        [/wax|شمع|إزالة|ازالة/, 'img/services/waxing.jpg'],
        [/massage|spa|مساج|تدليك/, 'img/services/massage.jpg'],
        [/color|colour|highlight|balayage|صبغ|هاي لايت/, 'img/services/color.jpg'],
        [/hair|cut|style|blow|شعر|قص|تصفيف/, 'img/services/hair.jpg']
      ]
      for (const [re, img] of rules) if (re.test(n)) return img
      return 'img/services/nails.jpg'
    },
    serviceCategory(s) {
      const n = ((s && ((s.name_en || '') + ' ' + (s.name_ar || ''))) || '').toLowerCase()
      const rules = [
        [/pedicure|باديكير/, 'cat_pedicure'],
        [/lash|eyelash|رموش/, 'cat_lashes'],
        [/brow|thread|حواجب|حاجب/, 'cat_brows'],
        [/bridal|wedding|عروس|زفاف/, 'cat_bridal'],
        [/makeup|make-up|مكياج|ميكاب/, 'cat_makeup'],
        [/facial|skin|clean|بشرة|تنظيف/, 'cat_facial'],
        [/wax|شمع|إزالة|ازالة/, 'cat_waxing'],
        [/massage|spa|مساج|تدليك|حمام كريمي/, 'cat_massage'],
        [/color|colour|highlight|balayage|صبغ|هاي لايت/, 'cat_color'],
        [/hair|cut|style|blow|شعر|قص|تصفيف/, 'cat_hair'],
        [/nail|manicure|gel|acrylic|أظافر|اظافر|مانيكير|جل|اكريليك/, 'cat_nails']
      ]
      for (const [re, key] of rules) if (re.test(n)) return this.t(key)
      return this.t('cat_default')
    },
    scrollToId(id) {
      const el = document.getElementById(id)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    bookService(s) {
      if (!s) return
      this.publicDone = null
      this.publicBooking.service_id = s.id
      this.$nextTick(() => this.scrollToId('booking'))
    },
    publicErrorKey(error) {
      const m = String((error && error.message) || '')
      if (m.includes('too_many_bookings')) return this.t('err_too_many_bookings')
      if (m.includes('too_many_requests')) return this.t('err_too_many_requests')
      if (m.includes('invalid_phone')) return this.t('err_phone')
      if (m.includes('invalid_date')) return this.t('err_public_date')
      if (m.includes('invalid_service') || m.includes('invalid_staff')) return this.t('err_public_choice')
      if (m.includes('invalid_client_name')) return this.t('err_required')
      if (m.includes('PGRST202') || m.includes('does not exist') || m.includes('schema cache')) return this.t('err_db_outdated')
      return this.t('error_generic')
    },
    async submitPublicBooking() {
      if (!sb || this.publicSubmitting) return
      const f = this.publicBooking
      this.publicFormError = ''
      if (!f.client_name.trim() || !f.client_phone.trim() || !f.service_id || !f.staff_id || !f.appointment_date) {
        this.publicFormError = this.t('err_required')
        return
      }
      if (f.client_name.trim().length < 2 || f.client_phone.replace(/\D/g, '').length < 8) {
        this.publicFormError = this.t('err_phone')
        return
      }
      if (!f.consent) {
        this.publicFormError = this.t('err_consent')
        return
      }
      const iso = this.toSalonISO(f.appointment_date)
      if (!iso || new Date(iso).getTime() < Date.now() + 10 * 60 * 1000) {
        this.publicFormError = this.t('err_public_date')
        return
      }
      const service = this.bookingService
      const staff = this.bookingStaff
      this.publicSubmitting = true
      const { data, error } = await sb.rpc('public_booking', {
        p_client_name: f.client_name.trim(),
        p_client_phone: f.client_phone.trim(),
        p_service_id: f.service_id,
        p_staff_id: f.staff_id,
        p_appointment_date: iso,
        p_notes: f.notes.trim() || null
      })
      this.publicSubmitting = false
      if (error) {
        this.publicFormError = this.publicErrorKey(error)
        return
      }
      const invoice = data && data.length ? (data[0].invoice_no || '') : ''
      this.publicDone = {
        invoice,
        name: f.client_name.trim(),
        phone: f.client_phone.trim(),
        service: service ? this.publicServiceName(service) : '',
        staff: staff ? staff.name : '',
        when: this.fmtDateTime(iso)
      }
      this.resetPublicBooking()
      this.$nextTick(() => this.scrollToId('booking'))
    },
    waHref(phone, text) {
      let d = String(phone || '').replace(/\D/g, '')
      if (d.length === 8) d = '973' + d
      if (!d) return '#'
      return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '')
    },
    staffOptionLabel(s) {
      return s.name
    },
    apptStatusLabel(s) {
      return this.t('status_' + s)
    },
    apptStatusClass(s) {
      return {
        pending: 'bg-amber-100 text-amber-700',
        completed: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-gray-200 text-gray-500'
      }[s] || 'bg-gray-100 text-gray-600'
    },

    async submitBooking() {
      if (!sb || !this.canAccess) return
      const p = this.pos
      if (!p.client_name || !p.client_phone || !p.service_id || !p.staff_id || !p.appointment_date) {
        this.showToast('error', this.t('err_required'))
        return
      }
      if (p.client_name.trim().length < 2 || p.client_phone.replace(/\D/g, '').length < 6) {
        this.showToast('error', this.t('err_phone'))
        return
      }
      this.submitting = true
      let error = null
      let newId = null
      let invoiceNo = ''
      if (this.user) {
        const { data, error: err } = await sb.from('appointments').insert({
          client_name: p.client_name.trim(),
          client_phone: p.client_phone.trim(),
          service_id: p.service_id,
          staff_id: p.staff_id,
          appointment_date: this.toSalonISO(p.appointment_date),
          payment_proof: p.payment_proof.trim() || null,
          notes: p.notes.trim() || null
        }).select('id, invoice_no').single()
        error = err
        if (data) { newId = data.id; invoiceNo = data.invoice_no || '' }
      } else if (this.staffSession) {
        const { data, error: err } = await sb.rpc('staff_create_booking', {
          p_token: this.staffSession.token,
          p_client_name: p.client_name.trim(),
          p_client_phone: p.client_phone.trim(),
          p_service_id: p.service_id,
          p_staff_id: p.staff_id,
          p_appointment_date: this.toSalonISO(p.appointment_date),
          p_payment_proof: p.payment_proof.trim() || null,
          p_notes: p.notes.trim() || null
        })
        error = err
        if (data && data.length) { newId = data[0].id; invoiceNo = data[0].invoice_no || '' }
        if (error && String(error.message || '').includes('invalid_session')) {
          this.clearStaffSession()
          this.staffLoginOpen = true
        }
      }
      this.submitting = false
      if (error) {
        console.error('[submitBooking]', error)
        const key = this.dbErrorKey(error)
        this.errorToast(error)
        if (key === 'err_session_expired' && this.user) {
          try { await sb.auth.signOut() } catch (_e) { /* ignore */ }
          this.user = null
          this.loginOpen = true
        }
        return
      }
      const svc = this.selectedService
      const stf = this.selectedStaff
      const total = this.posTotal
      const vat = this.posVat
      this.lastBooking = {
        id: newId,
        invoice: invoiceNo,
        name: p.client_name.trim(),
        phone: p.client_phone.trim(),
        service: svc ? this.svcName(svc) : '',
        staff: stf ? stf.name : '',
        total,
        net: Math.round((total - vat) * 1000) / 1000,
        vat,
        vatNumber: this.settings.vat_number || '',
        when: this.fmtDateTime(this.toSalonISO(p.appointment_date)),
        proof: p.payment_proof.trim(),
        invoiceText: ''
      }
      // Pull the authoritative bilingual invoice text from the database.
      if (newId) {
        try {
          const { data } = await sb.rpc('invoice_for', {
            p_token: this.staffSession ? this.staffSession.token : null,
            p_appointment_id: newId
          })
          if (data) this.lastBooking.invoiceText = data
        } catch (_e) { /* the WhatsApp button stays hidden without the text */ }
      }
      this.showToast('success', this.t('booking_created'))
      this.resetPos()
      if (this.user) this.loadToday()
    },
    // Turns a database error into a helpful message: a missing column/function
    // means the database still runs an older version of schema.sql.
    dbErrorKey(error) {
      const code = String((error && error.code) || '')
      const msg = String((error && error.message) || '')
      if (code === '42703' || code === 'PGRST202' || code === 'PGRST204' || code === '23502' ||
          /does not exist|schema cache|Could not find the|null value in column/i.test(msg)) {
        return 'err_db_outdated'
      }
      if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
        return 'err_no_permission'
      }
      if (code === 'PGRST301' || code === '401' || /jwt|token.*expired|session.*expired|not authenticated/i.test(msg)) {
        return 'err_session_expired'
      }
      if (code === '23503' || /invalid service_id|foreign key/i.test(msg)) {
        return 'err_invalid_choice'
      }
      return 'error_generic'
    },
    // Show a friendly message, and — for the signed-in admin only — the raw
    // database detail so a failing save can be diagnosed from the screen.
    errorToast(error) {
      console.error('[db]', error)
      let msg = this.t(this.dbErrorKey(error))
      let detailed = false
      if (this.user) {
        const code = (error && error.code) ? '[' + error.code + '] ' : ''
        const detail = (error && (error.message || error.details || error.hint)) || ''
        if (detail) { msg += ' · ' + code + detail; detailed = true }
      }
      this.showToast('error', msg)
      if (detailed) {
        clearTimeout(this.toastTimer)
        this.toastTimer = setTimeout(() => { this.toast.show = false }, 20000)
      }
    },
    // Digits of the client's number, ready for a wa.me link (973 for local numbers).
    clientWaDigits() {
      const b = this.lastBooking
      if (!b) return ''
      let d = (b.phone || '').replace(/\D/g, '')
      if (d.length === 8) d = '973' + d
      return d
    },
    invoiceLink() {
      const b = this.lastBooking
      const d = this.clientWaDigits()
      if (!b || !d || !b.invoiceText) return '#'
      return 'https://wa.me/' + d + '?text=' + encodeURIComponent(b.invoiceText)
    },
    // Open the official invoice for one appointment in WhatsApp (admin or own staff booking).
    async openInvoice(a) {
      if (!sb || !a) return
      const w = window.open('', '_blank')
      try {
        const { data, error } = await sb.rpc('invoice_for', {
          p_token: this.staffSession ? this.staffSession.token : null,
          p_appointment_id: a.id
        })
        if (error || !data) {
          if (w) w.close()
          this.errorToast(error)
          return
        }
        let d = (a.client_phone || '').replace(/\D/g, '')
        if (d.length === 8) d = '973' + d
        const url = 'https://wa.me/' + d + '?text=' + encodeURIComponent(data)
        if (w) w.location.href = url
        else window.open(url, '_blank', 'noopener')
      } catch (_e) {
        if (w) w.close()
        this.showToast('error', this.t('error_generic'))
      }
    },
    resetPos() {
      const d = new Date()
      d.setMinutes(0, 0, 0)
      d.setHours(d.getHours() + 1)
      this.pos = {
        client_name: '',
        client_phone: '',
        service_id: '',
        staff_id: '',
        appointment_date: this.localInputStr(d),
        payment_proof: '',
        notes: ''
      }
    },
    waNumber() {
      return (this.settings.admin_whatsapp || '').replace(/\D/g, '')
    },
    waLink() {
      const b = this.lastBooking
      const n = this.waNumber()
      if (!b || !n) return '#'
      const lines = [
        this.t('wa_new_booking'),
        '——————————',
        `${this.t('client_name')}: ${b.name}`,
        `${this.t('client_phone')}: ${b.phone}`,
        `${this.t('service')}: ${b.service}`,
        `${this.t('staff')}: ${b.staff}`,
        `${this.t('date_time')}: ${b.when}`
      ]
      if (b.proof) lines.push(`${this.t('payment_reference')}: ${b.proof}`)
      lines.push(`${this.t('total_price')}: ${this.fmtBHD(b.total)}`)
      return `https://wa.me/${n}?text=${encodeURIComponent(lines.join('\n'))}`
    },

    async loadToday() {
      if (!sb || !this.user) return
      this.todayLoading = true
      const start = new Date(this.bhDay(new Date()) + 'T00:00:00+03:00')
      const end = new Date(start.getTime() + 86400000)
      const { data, error } = await sb.from('appointments')
        .select('*, services(name_ar, name_en), staff(name, commission_rate)')
        .gte('appointment_date', start.toISOString())
        .lt('appointment_date', end.toISOString())
        .order('appointment_date', { ascending: true })
      this.todayLoading = false
      if (!error) this.todaysAppts = data || []
    },
    async updateStatus(a, status) {
      if (!sb) return
      const { error } = await sb.from('appointments').update({ status }).eq('id', a.id)
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      a.status = status
      this.showToast('success', this.t('saved'))
      this.loadToday()
    },
    async deleteAppt(a) {
      if (!sb) return
      const ok = await this.askConfirm(this.t('delete_appt_confirm'))
      if (!ok) return
      const { error } = await sb.from('appointments').delete().eq('id', a.id)
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      this.showToast('success', this.t('deleted'))
      this.loadAppts()
      this.loadToday()
    },
    async loadAppts() {
      if (!sb || !this.user) return
      this.apptsLoading = true
      let q = sb.from('appointments')
        .select('*, services(name_ar, name_en), staff(name)')
        .order('appointment_date', { ascending: false })
        .limit(500)
      if (this.apptFilter.status !== 'all') q = q.eq('status', this.apptFilter.status)
      if (this.apptFilter.from) q = q.gte('appointment_date', new Date(this.apptFilter.from + 'T00:00:00+03:00').toISOString())
      if (this.apptFilter.to) q = q.lte('appointment_date', new Date(this.apptFilter.to + 'T23:59:59.999+03:00').toISOString())
      const { data, error } = await q
      this.apptsLoading = false
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      this.appts = data || []
    },
    clearApptFilter() {
      this.apptFilter = { status: 'all', from: '', to: '' }
      this.apptSearch = ''
      this.loadAppts()
    },

    openSvcModal(s = null) {
      this.svcForm = s
        ? { id: s.id, name_ar: s.name_ar, name_en: s.name_en, price: s.price, is_active: s.is_active !== false }
        : { id: null, name_ar: '', name_en: '', price: '', is_active: true }
      this.svcModal = true
    },
    async saveSvc() {
      if (!sb) return
      const f = this.svcForm
      if (!f.name_ar.trim() || !f.name_en.trim() || f.price === '' || !(Number(f.price) >= 0)) {
        this.showToast('error', this.t('err_required'))
        return
      }
      this.svcSaving = true
      const payload = {
        name_ar: f.name_ar.trim(),
        name_en: f.name_en.trim(),
        price: Number(f.price),
        is_active: Boolean(f.is_active)
      }
      const q = f.id
        ? sb.from('services').update(payload).eq('id', f.id)
        : sb.from('services').insert(payload)
      const { error } = await q
      this.svcSaving = false
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      this.svcModal = false
      this.showToast('success', this.t('saved'))
      this.loadServices()
    },
    async deleteSvc(s) {
      if (!sb) return
      const ok = await this.askConfirm(this.t('delete_service_confirm'))
      if (!ok) return
      const { error } = await sb.from('services').delete().eq('id', s.id)
      if (error) {
        this.showToast('error', this.t('service_in_use'))
        return
      }
      this.showToast('success', this.t('deleted'))
      this.loadServices()
    },
    async toggleSvc(s) {
      if (!sb) return
      const { error } = await sb.from('services').update({ is_active: !s.is_active }).eq('id', s.id)
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      s.is_active = !s.is_active
      this.showToast('success', this.t('saved'))
    },

    openStfModal(s = null) {
      this.stfForm = s
        ? {
            id: s.id,
            name: s.name,
            phone: s.phone || '',
            commission_rate: s.commission_rate,
            username: s.username || '',
            password: '',
            login_enabled: s.login_enabled === true,
            was_enabled: s.login_enabled === true
          }
        : {
            id: null,
            name: '',
            phone: '',
            commission_rate: 10,
            username: '',
            password: '',
            login_enabled: false,
            was_enabled: false
          }
      this.stfModal = true
    },
    async saveStf() {
      if (!sb) return
      const f = this.stfForm
      const rate = Number(f.commission_rate)
      if (!f.name.trim() || !(rate >= 0 && rate <= 100)) {
        this.showToast('error', this.t('err_required'))
        return
      }
      const username = (f.username || '').trim().toLowerCase()
      const password = (f.password || '').trim()
      if (username && !/^[a-z0-9._-]{3,32}$/.test(username)) {
        this.showToast('error', this.t('err_username_invalid'))
        return
      }
      if (password && password.length < 6) {
        this.showToast('error', this.t('err_password_short'))
        return
      }
      if (f.login_enabled && (!username || (!password && !(f.id && f.was_enabled)))) {
        this.showToast('error', this.t('err_login_incomplete'))
        return
      }

      this.stfSaving = true
      const payload = {
        name: f.name.trim(),
        phone: (f.phone || '').trim() || null,
        commission_rate: rate
      }

      let staffId = f.id
      if (staffId) {
        const { error } = await sb.from('staff').update(payload).eq('id', staffId)
        if (error) {
          this.stfSaving = false
          this.showToast('error', this.t('error_generic'))
          return
        }
      } else {
        const { data, error } = await sb.from('staff').insert(payload).select('id').single()
        if (error || !data) {
          this.stfSaving = false
          this.showToast('error', this.t('error_generic'))
          return
        }
        staffId = data.id
      }

      // Credentials are stored hashed by a SECURITY DEFINER RPC.
      const { error: credError } = await sb.rpc('admin_set_staff_login', {
        p_staff_id: staffId,
        p_username: username || null,
        p_password: password || null,
        p_enabled: Boolean(f.login_enabled)
      })
      this.stfSaving = false
      if (credError) {
        // Do not leave a half-created staff row when the login could not be saved.
        if (!f.id) {
          await sb.from('staff').delete().eq('id', staffId)
        }
        const msg = String(credError.message || '')
        if (msg.includes('username_taken')) this.showToast('error', this.t('err_username_taken'))
        else if (msg.includes('weak_password')) this.showToast('error', this.t('err_password_short'))
        else if (msg.includes('invalid_username')) this.showToast('error', this.t('err_username_invalid'))
        else this.showToast('error', this.t('error_generic'))
        return
      }

      this.stfModal = false
      this.showToast('success', this.t('saved'))
      this.loadStaff()
    },
    async deleteStf(s) {
      if (!sb) return
      const ok = await this.askConfirm(this.t('delete_staff_confirm'))
      if (!ok) return
      const { error } = await sb.from('staff').delete().eq('id', s.id)
      if (error) {
        this.showToast('error', this.t('staff_in_use'))
        return
      }
      this.showToast('success', this.t('deleted'))
      this.loadStaff()
    },
    async toggleStf(s) {
      if (!sb) return
      const { error } = await sb.from('staff').update({ is_active: !s.is_active }).eq('id', s.id)
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      s.is_active = !s.is_active
      this.showToast('success', this.t('saved'))
    },

    async saveSettings() {
      if (!sb) return
      const sheetUrl = String(this.settings.google_sheet_url || '').trim()
      if (sheetUrl && !/^https:\/\/script\.google\.com\//i.test(sheetUrl)) {
        this.showToast('error', this.t('sheet_url_invalid'))
        return
      }
      // Bare values such as "instagram.com/salon" are completed to https://.
      ;['social_instagram', 'social_tiktok', 'social_snapchat', 'social_facebook', 'social_x', 'social_youtube'].forEach(k => {
        const v = String(this.settings[k] || '').trim()
        this.settings[k] = v && !/^https?:\/\//i.test(v) ? 'https://' + v.replace(/^\/+/, '') : v
      })
      ;['logo_url', 'hero_image_url', 'about_image_url', 'map_url', 'social_whatsapp'].forEach(k => {
        this.settings[k] = String(this.settings[k] || '').trim()
      })
      const keys = [
        'salon_name', 'salon_phone', 'salon_address', 'salon_hours', 'map_url', 'salon_email',
        'logo_url', 'hero_image_url', 'about_image_url',
        'brand_tagline_ar', 'brand_tagline_en', 'about_text_ar', 'about_text_en',
        'social_instagram', 'social_tiktok', 'social_snapchat', 'social_facebook',
        'social_x', 'social_youtube', 'social_whatsapp',
        'seo_title_ar', 'seo_title_en', 'seo_description_ar', 'seo_description_en',
        'admin_whatsapp', 'evolution_api_url', 'evolution_api_key', 'evolution_instance',
        'vat_rate', 'vat_inclusive', 'vat_number', 'google_sheet_url'
      ]
      const rows = keys
        // Never create empty rows for keys this database has not seeded yet:
        // an explicit empty string (the manager cleared a field) is kept.
        .filter(k => this.settings[k] !== undefined)
        .map(k => ({
          setting_key: k,
          setting_value: String(this.settings[k] == null ? '' : this.settings[k])
        }))
      this.settingsSaving = true
      const { error } = await sb.from('settings').upsert(rows, { onConflict: 'setting_key' })
      this.settingsSaving = false
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      this.showToast('success', this.t('settings_saved'))
      // Refresh the public identity so the header, footer, contact card and
      // social links reflect the new values immediately, without a reload.
      await this.loadBranding()
    },

    async savePages() {
      if (!sb) return
      const fields = ['title_ar', 'title_en', 'intro_ar', 'intro_en', 'body_ar', 'body_en']
      const rows = []
      this.pageDefs.forEach(pg => {
        fields.forEach(field => {
          const key = 'legal_' + pg.slug + '_' + field
          if (this.settings[key] === undefined) return
          rows.push({ setting_key: key, setting_value: String(this.settings[key] == null ? '' : this.settings[key]) })
        })
      })
      if (!rows.length) {
        this.showToast('error', this.t('pages_no_content'))
        return
      }
      this.pagesSaving = true
      const { error } = await sb.from('settings').upsert(rows, { onConflict: 'setting_key' })
      this.pagesSaving = false
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      this.showToast('success', this.t('pages_saved'))
    },

    async uploadBrandImage(event, key) {
      const input = event && event.target
      const file = input && input.files && input.files[0]
      if (!sb || !this.user) return
      if (!file) return
      input.value = ''
      if (!/^image\//i.test(file.type)) {
        this.showToast('error', this.t('image_invalid'))
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        this.showToast('error', this.t('image_too_large'))
        return
      }
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = this.user.id + '/' + key.replace(/_url$/, '') + '-' + Date.now() + '.' + ext
      this.logoUploading = true
      const { error } = await sb.storage.from('branding').upload(path, file, {
        cacheControl: '31536000',
        upsert: false
      })
      if (error) {
        this.logoUploading = false
        this.showToast('error', this.t('upload_failed'))
        return
      }
      const { data } = sb.storage.from('branding').getPublicUrl(path)
      const url = data && data.publicUrl ? data.publicUrl : ''
      this.logoUploading = false
      if (!url) {
        this.showToast('error', this.t('upload_failed'))
        return
      }
      this.settings[key] = url
      if (key === 'logo_url') this.publicInfo = { ...this.publicInfo, logo_url: url }
      const { error: saveError } = await sb.from('settings').upsert(
        { setting_key: key, setting_value: url },
        { onConflict: 'setting_key' }
      )
      if (!saveError) this.applyBranding()
      this.showToast(saveError ? 'error' : 'success', saveError ? this.t('error_generic') : this.t('image_uploaded'))
    },

    async saveStaffCode() {
      if (!sb || !this.user) return
      const code = (this.newStaffCode || '').trim()
      if (code.length < 4) {
        this.showToast('error', this.t('err_code_short'))
        return
      }
      this.staffCodeSaving = true
      const { error } = await sb.rpc('admin_set_staff_code', { p_code: code })
      this.staffCodeSaving = false
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      this.staffCodeSet = true
      this.newStaffCode = ''
      this.showToast('success', this.t('code_saved'))
    },
    async clearStaffCode() {
      if (!sb || !this.user) return
      const ok = await this.askConfirm(this.t('clear_code_confirm'))
      if (!ok) return
      const { error } = await sb.rpc('admin_set_staff_code', { p_code: '' })
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      this.staffCodeSet = false
      this.showToast('success', this.t('code_cleared'))
    },

    async testWhatsapp() {
      if (!sb || !this.user) return
      const phone = (this.waTestPhone || '').trim()
      if (!phone) {
        this.showToast('error', this.t('wa_test_required'))
        return
      }
      this.waTesting = true
      const { data, error } = await sb.rpc('admin_test_whatsapp', { p_phone: phone })
      this.waTesting = false
      if (error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      if (data == null) {
        this.showToast('error', this.t('wa_test_missing'))
        return
      }
      if (Number(data) < 0) {
        this.showToast('error', this.t('wa_test_failed'))
        setTimeout(() => this.loadWaLog(), 1500)
        return
      }
      this.showToast('success', this.t('wa_test_sent'))
      setTimeout(() => this.loadWaLog(), 3000)
    },

    async loadWaLog() {
      if (!sb || !this.user) return
      this.waLogLoading = true
      const { data, error } = await sb.rpc('admin_whatsapp_log')
      this.waLogLoading = false
      if (!error) this.waLog = data || []
    },

    waKindLabel(kind) {
      return {
        admin: this.t('wa_kind_admin'),
        client: this.t('wa_kind_client'),
        test: this.t('wa_kind_test')
      }[kind] || kind || ''
    },
    waSkipped(row) {
      return Boolean(row && row.message && String(row.message).indexOf('SKIPPED') === 0)
    },
    waLogLabel(row) {
      if (!row) return ''
      if (this.waSkipped(row)) return this.t('wa_skipped')
      if (row.status_code == null && !row.error_message) return this.t('wa_pending')
      if (row.error_message) return this.t('wa_failed')
      if (row.status_code >= 200 && row.status_code < 300) return this.t('wa_ok')
      return this.t('wa_failed')
    },
    waLogClass(row) {
      if (!row) return 'bg-gray-100 text-gray-600'
      if (this.waSkipped(row)) return 'bg-amber-100 text-amber-700'
      if (row.status_code >= 200 && row.status_code < 300 && !row.error_message) return 'bg-emerald-100 text-emerald-700'
      if (row.status_code == null && !row.error_message) return 'bg-amber-100 text-amber-700'
      return 'bg-rose-100 text-rose-700'
    },

    // ---------------- Google Sheets ----------------
    async testSheet() {
      if (!sb || !this.user) return
      if (!String(this.settings.google_sheet_url || '').trim()) {
        this.showToast('error', this.t('sheet_url_missing'))
        return
      }
      this.sheetTesting = true
      const { data, error } = await sb.rpc('admin_test_sheet')
      this.sheetTesting = false
      if (error) {
        this.errorToast(error)
        return
      }
      if (data == null) {
        this.showToast('error', this.t('sheet_url_missing'))
        return
      }
      if (Number(data) < 0) {
        this.showToast('error', this.t('sheet_test_failed'))
        setTimeout(() => this.loadSheetLog(), 1500)
        return
      }
      this.showToast('success', this.t('sheet_test_sent'))
      setTimeout(() => this.loadSheetLog(), 3000)
    },
    async syncAllToSheet() {
      if (!sb || !this.user) return
      if (!String(this.settings.google_sheet_url || '').trim()) {
        this.showToast('error', this.t('sheet_url_missing'))
        return
      }
      const ok = await this.askConfirm(this.t('sheet_sync_confirm'))
      if (!ok) return
      this.sheetSyncing = true
      const { data, error } = await sb.rpc('admin_sync_all_to_sheet')
      this.sheetSyncing = false
      if (error) {
        this.errorToast(error)
        return
      }
      this.showToast('success', this.t('sheet_sync_done').replace('{count}', String(data || 0)))
      setTimeout(() => this.loadSheetLog(), 3000)
    },
    async loadSheetLog() {
      if (!sb || !this.user) return
      this.sheetLogLoading = true
      const { data, error } = await sb.rpc('admin_sheet_log')
      this.sheetLogLoading = false
      if (!error) this.sheetLog = data || []
    },
    sheetKindLabel(kind) {
      return {
        booking: this.t('sheet_kind_booking'),
        bulk: this.t('sheet_kind_bulk'),
        test: this.t('sheet_kind_test')
      }[kind] || kind || ''
    },
    sheetSkipped(row) {
      return Boolean(row && row.message && String(row.message).indexOf('SKIPPED') === 0)
    },
    sheetLogLabel(row) {
      if (!row) return ''
      if (this.sheetSkipped(row)) return this.t('sheet_skipped')
      if (row.status_code == null) return this.t('sheet_status_pending')
      if (row.status_code >= 200 && row.status_code < 300) return this.t('sheet_status_ok')
      return this.t('sheet_status_failed')
    },
    sheetLogClass(row) {
      if (!row) return 'bg-gray-100 text-gray-600'
      if (this.sheetSkipped(row)) return 'bg-amber-100 text-amber-700'
      if (row.status_code >= 200 && row.status_code < 300) return 'bg-emerald-100 text-emerald-700'
      if (row.status_code == null) return 'bg-amber-100 text-amber-700'
      return 'bg-rose-100 text-rose-700'
    },
    async copySheetScript() {
      const code = this.sheetScript
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(code)
        } else {
          const ta = document.createElement('textarea')
          ta.value = code
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        this.showToast('success', this.t('copied'))
      } catch (_e) {
        this.showToast('error', this.t('error_generic'))
      }
    },
    get sheetScript() {
      return `/**
 * Salon bookings & expenses sync
 * 1) Create a Google Sheet, then Extensions > Apps Script.
 * 2) Paste this code, save, and deploy as a Web App:
 *    Execute as: Me  |  Who has access: Anyone
 * 3) Copy the /exec URL into Admin > Settings > Google Sheets.
 * Bookings go to the "Bookings" tab and expenses to the "Expenses" tab.
 */
var BOOKINGS_SHEET = 'Bookings'
var EXPENSES_SHEET = 'Expenses'

function doPost(e) {
  var lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    var data = JSON.parse(e.postData.contents)
    var ss = SpreadsheetApp.getActiveSpreadsheet()
    var result = (data.kind === 'expense')
      ? writeExpense_(ss, data)
      : writeBooking_(ss, data)
    return json_(result)
  } catch (err) {
    return json_({ ok: false, error: String(err) })
  } finally {
    lock.releaseLock()
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name)
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers)
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#fce7f3')
    sh.setFrozenRows(1)
  }
  return sh
}

function upsert_(sh, key, row) {
  var target = 0
  if (key) {
    var last = sh.getLastRow()
    if (last > 1) {
      var values = sh.getRange(2, 1, last - 1, 1).getValues()
      for (var i = 0; i < values.length; i++) {
        if (String(values[i][0]) === String(key)) { target = i + 2; break }
      }
    }
  }
  if (target) {
    sh.getRange(target, 1, 1, row.length).setValues([row])
  } else {
    sh.appendRow(row)
  }
}

function writeBooking_(ss, data) {
  var headers = [
    'Invoice', 'Created', 'Appointment', 'Client', 'Phone',
    'Service (AR)', 'Service (EN)', 'Staff', 'Subtotal BHD',
    'VAT BHD', 'Total BHD', 'VAT No.', 'Status', 'Reference', 'Notes'
  ]
  var sh = ensureSheet_(ss, BOOKINGS_SHEET, headers)
  var row = [
    data.invoice_no || '', data.created_at || '', data.appointment_date || '',
    data.client_name || '', data.client_phone || '', data.service_ar || '',
    data.service_en || '', data.staff || '', data.subtotal || 0,
    data.vat || 0, data.total || 0, data.vat_number || '',
    data.status || '', data.payment_proof || '', data.notes || ''
  ]
  var invoice = String(data.invoice_no || '')
  upsert_(sh, invoice, row)
  return { ok: true, invoice: invoice }
}

function writeExpense_(ss, data) {
  var headers = [
    'ID', 'Created', 'Expense date', 'Title', 'Amount BHD',
    'Method', 'Staff', 'Added by', 'Notes', 'Supplier',
    'Supplier VAT No.', 'Supplier Invoice No.', 'Net BHD', 'VAT BHD'
  ]
  var sh = ensureSheet_(ss, EXPENSES_SHEET, headers)
  // Keep headers current even on sheets created by an older version.
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
  var row = [
    data.id || '', data.created_at || '', data.spent_at || '',
    data.title || '', data.amount || 0, data.method || '',
    data.staff || '', data.created_by || '', data.notes || '',
    data.vendor_name || '', data.vendor_vat_no || '', data.invoice_no || '',
    data.net_amount || 0, data.vat_amount || 0
  ]
  upsert_(sh, data.id, row)
  return { ok: true, expense: String(data.id || '') }
}`
    },

    setQuick(kind) {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth()
      let from, to
      if (kind === 'today') {
        from = new Date(y, m, now.getDate())
        to = from
      } else if (kind === 'month') {
        from = new Date(y, m, 1)
        to = now
      } else if (kind === 'lastMonth') {
        from = new Date(y, m - 1, 1)
        to = new Date(y, m, 0)
      } else {
        from = new Date(y, 0, 1)
        to = now
      }
      this.report.from = this.localDateStr(from)
      this.report.to = this.localDateStr(to)
      this.runReport()
    },

    // ---------------- Expenses ----------------
    buildExpenseTotals() {
      let total = 0
      let cash = 0
      let benefitpay = 0
      let vat = 0
      this.expenses.forEach(e => {
        const a = Number(e.amount) || 0
        total += a
        vat += Number(e.vat_amount) || 0
        if (e.method === 'benefitpay') benefitpay += a
        else cash += a
      })
      this.expenseTotals = { count: this.expenses.length, total, cash, benefitpay, vat }
    },
    // Net amount before VAT for the expense currently being entered.
    get expenseNet() {
      const amount = parseFloat(this.expenseForm.amount) || 0
      const vat = parseFloat(this.expenseForm.vat_amount) || 0
      return Math.max(0, Math.round((amount - vat) * 1000) / 1000)
    },
    // Estimate the input VAT from the gross amount using the salon's VAT rate
    // (purchase totals in Bahrain are normally VAT-inclusive). Optional: the
    // user can always type the exact VAT shown on the supplier invoice.
    calcExpenseVat() {
      const amount = parseFloat(this.expenseForm.amount) || 0
      const rate = Math.max(0, parseFloat(this.settings.vat_rate || '10')) / 100
      if (!amount || !rate) return
      const vat = amount - amount / (1 + rate)
      this.expenseForm.vat_amount = (Math.round(vat * 1000) / 1000).toFixed(3)
    },
    async loadExpenses() {
      if (!sb) return
      // Only the admin may read expense records. Staff can add an expense but
      // never list, total or delete them.
      if (!this.user) {
        this.expensesLoading = false
        this.expenses = []
        this.buildExpenseTotals()
        return
      }
      this.expensesLoading = true
      let q = sb.from('expenses')
        .select('*, staff(name)')
        .order('spent_at', { ascending: false })
        .limit(1000)
      const f = this.expenseFilter
      if (f.from) q = q.gte('spent_at', new Date(f.from + 'T00:00:00+03:00').toISOString())
      if (f.to) q = q.lte('spent_at', new Date(f.to + 'T23:59:59.999+03:00').toISOString())
      const { data, error } = await q
      this.expensesLoading = false
      if (error) { this.errorToast(error); return }
      this.expenses = data || []
      this.buildExpenseTotals()
    },
    expenseMethodLabel(m) {
      return m === 'benefitpay' ? this.t('expense_benefitpay') : this.t('expense_cash')
    },
    expenseAddedBy(e) {
      if (e.staff && e.staff.name) return e.staff.name
      if (e.created_by === 'staff') return (this.staffSession && this.staffSession.name) || this.t('expense_added_by_staff')
      return this.t('expense_added_by_admin')
    },
    async saveExpense() {
      if (!sb) return
      const f = this.expenseForm
      const title = (f.title || '').trim()
      const amount = parseFloat(f.amount)
      if (title.length < 2) {
        this.showToast('error', this.t('err_expense_title'))
        return
      }
      if (!isFinite(amount) || amount <= 0) {
        this.showToast('error', this.t('err_expense_amount'))
        return
      }
      if (!['cash', 'benefitpay'].includes(f.method)) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      const vatAmount = parseFloat(f.vat_amount) || 0
      if (vatAmount < 0 || vatAmount > amount) {
        this.showToast('error', this.t('err_expense_vat'))
        return
      }
      const vendorName = (f.vendor_name || '').trim() || null
      const vendorVatNo = (f.vendor_vat_no || '').trim() || null
      const invoiceNo = (f.invoice_no || '').trim() || null
      const spentAt = f.spent_at ? this.toSalonISO(f.spent_at + 'T12:00') : new Date().toISOString()
      this.expenseSaving = true
      let error = null
      if (this.user) {
        const { error: err } = await sb.from('expenses').insert({
          title,
          amount: Math.round(amount * 1000) / 1000,
          method: f.method,
          notes: (f.notes || '').trim() || null,
          vendor_name: vendorName,
          vendor_vat_no: vendorVatNo,
          invoice_no: invoiceNo,
          vat_amount: Math.round(vatAmount * 1000) / 1000,
          staff_id: null,
          created_by: 'admin',
          spent_at: spentAt
        })
        error = err
      } else if (this.staffSession) {
        const { error: err } = await sb.rpc('staff_create_expense', {
          p_token: this.staffSession.token,
          p_title: title,
          p_amount: amount,
          p_method: f.method,
          p_notes: (f.notes || '').trim() || null,
          p_spent_at: spentAt,
          p_vendor_name: vendorName,
          p_vendor_vat_no: vendorVatNo,
          p_invoice_no: invoiceNo,
          p_vat_amount: vatAmount
        })
        error = err
        if (error && String(error.message || '').includes('invalid_session')) {
          this.clearStaffSession()
          this.staffLoginOpen = true
        }
      }
      this.expenseSaving = false
      if (error) {
        console.error('[saveExpense]', error)
        this.errorToast(error)
        return
      }
      this.showToast('success', this.t('expense_saved'))
      this.expenseForm = {
        title: '', amount: '', method: f.method, notes: '', spent_at: f.spent_at,
        vendor_name: '', vendor_vat_no: '', invoice_no: '', vat_amount: ''
      }
      if (this.user) await this.loadExpenses()
    },
    async deleteExpense(e) {
      if (!sb || !e || !this.user) return
      const ok = await this.askConfirm(this.t('expense_delete_confirm'))
      if (!ok) return
      const { error } = await sb.from('expenses').delete().eq('id', e.id)
      if (error) {
        this.errorToast(error)
        return
      }
      this.showToast('success', this.t('expense_deleted'))
      await this.loadExpenses()
    },

    async runReport() {
      if (!sb || !this.report.from || !this.report.to) return
      this.reportLoading = true
      const from = new Date(this.report.from + 'T00:00:00+03:00')
      const to = new Date(this.report.to + 'T23:59:59.999+03:00')
      const [apptRes, expRes] = await Promise.all([
        sb.from('appointments')
          .select('*, services(name_ar, name_en), staff(name)')
          .gte('appointment_date', from.toISOString())
          .lte('appointment_date', to.toISOString())
          .order('appointment_date', { ascending: true }),
        sb.from('expenses')
          .select('*, staff(name)')
          .gte('spent_at', from.toISOString())
          .lte('spent_at', to.toISOString())
          .order('spent_at', { ascending: false })
      ])
      this.reportLoading = false
      if (apptRes.error) {
        this.errorToast(apptRes.error)
        return
      }
      this.reportRows = apptRes.data || []
      // The expenses table is optional until the latest schema.sql is run.
      this.reportExpenses = expRes.error ? [] : (expRes.data || [])
      this.buildReport()
      this.$nextTick(() => this.renderCharts())
    },
    buildReport() {
      const done = this.reportRows.filter(r => r.status === 'completed')
      let revenue = 0
      let commission = 0
      const staffMap = {}
      const svcMap = {}
      const dayMap = {}
      const monthMap = {}
      done.forEach(r => {
        const price = Number(r.total_price) || 0
        const comm = Number(r.commission_amount) || 0
        revenue += price
        commission += comm
        const sKey = r.staff_id || 'none'
        if (!staffMap[sKey]) staffMap[sKey] = { name: (r.staff && r.staff.name) || '—', count: 0, revenue: 0, commission: 0 }
        staffMap[sKey].count++
        staffMap[sKey].revenue += price
        staffMap[sKey].commission += comm
        const svKey = r.service_id || 'none'
        if (!svcMap[svKey]) svcMap[svKey] = { name: this.rowServiceName(r), count: 0, revenue: 0 }
        svcMap[svKey].count++
        svcMap[svKey].revenue += price
        const day = this.bhDay(r.appointment_date)
        if (!dayMap[day]) dayMap[day] = 0
        dayMap[day] += price
        const month = day.slice(0, 7)
        if (!monthMap[month]) monthMap[month] = 0
        monthMap[month] += price
      })
      let expenseTotal = 0
      let expenseCash = 0
      let expenseBenefitpay = 0
      let expenseVat = 0
      this.reportExpenses.forEach(e => {
        const a = Number(e.amount) || 0
        expenseTotal += a
        expenseVat += Number(e.vat_amount) || 0
        if (e.method === 'benefitpay') expenseBenefitpay += a
        else expenseCash += a
      })
      this.reportData = {
        count: done.length,
        bookings: this.reportRows.length,
        revenue,
        commission,
        avg: done.length ? revenue / done.length : 0,
        staff: Object.values(staffMap).sort((a, b) => b.revenue - a.revenue),
        services: Object.values(svcMap).sort((a, b) => b.count - a.count),
        days: Object.keys(dayMap).sort().map(day => ({ day, revenue: dayMap[day] })),
        months: Object.keys(monthMap).sort().map(month => ({ month, revenue: monthMap[month] })),
        expenses: this.reportExpenses,
        expenseCount: this.reportExpenses.length,
        expenseTotal,
        expenseCash,
        expenseBenefitpay,
        expenseVat,
        profit: revenue - commission - expenseTotal
      }
    },
    rowServiceName(r) {
      if (!r.services) return '—'
      return (this.lang === 'ar' ? r.services.name_ar : r.services.name_en) || r.services.name_en || r.services.name_ar || '—'
    },
    renderCharts() {
      if (typeof Chart === 'undefined' || !this.reportData) return
      const d = this.reportData
      if (!d.bookings && !d.expenseCount) return
      Chart.defaults.font.family = "'Cairo', sans-serif"
      Chart.defaults.color = '#6b7280'
      const monthly = this.report.interval === 'monthly'
      const points = monthly ? d.months : d.days
      if (this.charts.revenue) this.charts.revenue.destroy()
      if (this.charts.services) this.charts.services.destroy()
      if (this.charts.staff) this.charts.staff.destroy()
      if (this.charts.finance) this.charts.finance.destroy()
      const rc = document.getElementById('revenueChart')
      if (rc) {
        this.charts.revenue = new Chart(rc, {
          type: 'line',
          data: {
            labels: points.map(x => monthly ? this.fmtMonth(x.month) : this.fmtDay(x.day)),
            datasets: [{
              label: this.t('kpi_revenue'),
              data: points.map(x => x.revenue),
              borderColor: '#db2777',
              backgroundColor: 'rgba(219,39,119,0.10)',
              fill: true,
              tension: 0.35,
              pointBackgroundColor: '#db2777',
              pointRadius: 3,
              borderWidth: 2.5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: ctx => ' ' + this.fmtBHD(ctx.parsed.y) } }
            },
            scales: {
              y: { beginAtZero: true },
              x: { grid: { display: false } }
            }
          }
        })
      }
      const sc = document.getElementById('serviceChart')
      if (sc) {
        this.charts.services = new Chart(sc, {
          type: 'doughnut',
          data: {
            labels: d.services.map(s => s.name),
            datasets: [{
              data: d.services.map(s => s.count),
              backgroundColor: CHART_COLORS,
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
              tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + ctx.parsed } }
            }
          }
        })
      }
      const stc = document.getElementById('staffChart')
      if (stc) {
        this.charts.staff = new Chart(stc, {
          type: 'bar',
          data: {
            labels: d.staff.map(s => s.name),
            datasets: [
              { label: this.t('col_revenue'), data: d.staff.map(s => s.revenue), backgroundColor: '#f472b6', borderRadius: 6 },
              { label: this.t('col_commission'), data: d.staff.map(s => s.commission), backgroundColor: '#be185d', borderRadius: 6 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
              tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + this.fmtBHD(ctx.parsed.y) } }
            },
            scales: {
              y: { beginAtZero: true },
              x: { grid: { display: false } }
            }
          }
        })
      }

      // Sales → expenses + commissions + net profit breakdown (doughnut).
      const finc = document.getElementById('financeChart')
      if (finc) {
        const profit = Number(d.profit) || 0
        const loss = profit < 0
        const revenue = Math.max(0, Number(d.revenue) || 0)
        const items = [
          { label: this.t('chart_sales'), value: revenue, color: '#db2777' },
          { label: this.t('kpi_expenses'), value: Math.max(0, Number(d.expenseTotal) || 0), color: '#f59e0b' },
          { label: this.t('kpi_commission'), value: Math.max(0, Number(d.commission) || 0), color: '#a855f7' }
        ]
        // Only meaningful when there is completed revenue to distribute.
        if (revenue > 0) {
          items.push({
            label: loss ? this.t('chart_loss') : this.t('kpi_profit'),
            value: Math.abs(profit),
            color: loss ? '#e11d48' : '#10b981'
          })
        }
        const total = items.reduce((sum, item) => sum + item.value, 0)
        this.charts.finance = new Chart(finc, {
          type: 'doughnut',
          data: {
            labels: items.map(item => item.label),
            datasets: [{
              data: items.map(item => item.value),
              backgroundColor: items.map(item => item.color),
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            plugins: {
              legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const value = Number(ctx.parsed) || 0
                    const pct = total ? (value / total * 100).toFixed(1) : '0.0'
                    return ' ' + ctx.label + ': ' + this.fmtBHD(value) + ' (' + pct + '%)'
                  }
                }
              }
            }
          }
        })
      }
    },

    applyVatMonth() {
      if (!this.vatMonth) return
      const parts = this.vatMonth.split('-').map(Number)
      const y = parts[0]
      const m = parts[1]
      this.vat.from = this.localDateStr(new Date(y, m - 1, 1))
      this.vat.to = this.localDateStr(new Date(y, m, 0))
      this.runVat()
    },
    async runVat() {
      if (!sb || !this.vat.from || !this.vat.to) return
      this.vatLoading = true
      const from = new Date(this.vat.from + 'T00:00:00+03:00')
      const to = new Date(this.vat.to + 'T23:59:59.999+03:00')
      let q = sb.from('appointments')
        .select('*, services(name_ar, name_en), staff(name)')
        .gte('appointment_date', from.toISOString())
        .lte('appointment_date', to.toISOString())
        .order('appointment_date', { ascending: true })
      if (this.vat.basis === 'completed') q = q.eq('status', 'completed')
      else q = q.neq('status', 'cancelled')
      const [apptRes, expRes] = await Promise.all([
        q,
        sb.from('expenses')
          .select('amount, vat_amount, spent_at')
          .gte('spent_at', from.toISOString())
          .lte('spent_at', to.toISOString())
      ])
      this.vatLoading = false
      if (apptRes.error) {
        this.showToast('error', this.t('error_generic'))
        return
      }
      const rows = apptRes.data || []
      // Missing expenses table on an older database simply means no input VAT.
      const expenseRows = expRes.error ? [] : (expRes.data || [])
      const rate = Math.max(0, parseFloat(this.settings.vat_rate || '10')) / 100
      const inclusive = this.settings.vat_inclusive !== 'false'
      let gross = 0
      let net = 0
      let vat = 0
      let inputVat = 0
      const monthMap = {}
      rows.forEach(r => {
        const price = Number(r.total_price) || 0
        let g, n, v
        if (inclusive) {
          n = price / (1 + rate)
          v = price - n
          g = price
        } else {
          n = price
          v = n * rate
          g = n + v
        }
        gross += g
        net += n
        vat += v
        const ym = this.bhDay(r.appointment_date).slice(0, 7)
        if (!monthMap[ym]) monthMap[ym] = { ym, gross: 0, net: 0, vat: 0, input: 0 }
        monthMap[ym].gross += g
        monthMap[ym].net += n
        monthMap[ym].vat += v
      })
      expenseRows.forEach(e => {
        const v = Number(e.vat_amount) || 0
        inputVat += v
        const ym = this.bhDay(e.spent_at).slice(0, 7)
        if (!monthMap[ym]) monthMap[ym] = { ym, gross: 0, net: 0, vat: 0, input: 0 }
        monthMap[ym].input += v
      })
      this.vatResult = {
        count: rows.length,
        gross,
        net,
        vat,
        inputVat,
        netDue: vat - inputVat,
        rate,
        inclusive,
        months: Object.values(monthMap).sort((a, b) => a.ym.localeCompare(b.ym))
      }
    },
    exportVatCsv() {
      if (!this.vatResult) return
      const v = this.vatResult
      const rows = [
        [this.t('vat_title')],
        [this.salonName],
        ...(this.settings.vat_number ? [[this.t('vat_reg_no'), this.settings.vat_number]] : []),
        [this.t('vat_print_period'), `${this.vat.from} - ${this.vat.to}`],
        [this.t('vat_print_basis'), this.vat.basis === 'completed' ? this.t('basis_completed') : this.t('basis_all')],
        [this.t('vat_print_rate'), `${(v.rate * 100).toFixed(1)}%`],
        [],
        [this.t('col_month'), this.t('gross_sales'), this.t('net_taxable'), this.t('vat_collected'), this.t('vat_input'), this.t('vat_net_due')]
      ]
      v.months.forEach(m => rows.push([
        m.ym, m.gross.toFixed(3), m.net.toFixed(3), m.vat.toFixed(3),
        (m.input || 0).toFixed(3), (m.vat - (m.input || 0)).toFixed(3)
      ]))
      rows.push([
        this.t('total_row'), v.gross.toFixed(3), v.net.toFixed(3), v.vat.toFixed(3),
        v.inputVat.toFixed(3), v.netDue.toFixed(3)
      ])
      const csv = '\uFEFF' + rows.map(r => r.map(c => this.csvCell(c)).join(',')).join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `VAT-${this.vat.from}_${this.vat.to}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    },
    printVat() {
      if (!this.vatResult) return
      const v = this.vatResult
      const rtl = this.lang === 'ar'
      const money = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' ' + this.t('currency')
      const base = this.vat.basis === 'completed' ? this.t('basis_completed') : this.t('basis_all')
      const td = 'padding:8px;border:1px solid #f3d9e5;font-size:13px'
      const th = 'padding:8px;border:1px solid #f3d9e5;font-size:13px;background:#fdf2f8;font-weight:800'
      const sum = (label, value) => `<tr><td style="${td};font-weight:700">${label}</td><td style="${td};font-weight:700">${value}</td></tr>`
      const monthRows = v.months.map(m =>
        `<tr><td style="${td}">${this.fmtMonth(m.ym)}</td><td style="${td}">${money(m.gross)}</td><td style="${td}">${money(m.net)}</td><td style="${td}">${money(m.vat)}</td><td style="${td}">${money(m.input || 0)}</td><td style="${td}">${money(m.vat - (m.input || 0))}</td></tr>`
      ).join('')
      const totalRow = `<tr style="background:#fdf2f8;font-weight:800"><td style="${td}">${this.t('total_row')}</td><td style="${td}">${money(v.gross)}</td><td style="${td}">${money(v.net)}</td><td style="${td}">${money(v.vat)}</td><td style="${td}">${money(v.inputVat)}</td><td style="${td}">${money(v.netDue)}</td></tr>`
      const contactLine = [this.settings.salon_address, this.settings.salon_phone, this.settings.salon_email]
        .filter(Boolean).map(v => this.esc(v)).join(' · ')
      const logo = this.settings.logo_url
        ? `<img src="${this.esc(this.settings.logo_url)}" alt="" style="height:56px;width:56px;object-fit:contain;border-radius:14px;border:1px solid #fbcfe8;background:#fff" />`
        : ''
      document.getElementById('print-area').innerHTML = `
        <div dir="${rtl ? 'rtl' : 'ltr'}" style="font-family:'Cairo',sans-serif;color:#1f2937;padding:24px;max-width:800px;margin:0 auto">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            ${logo}
            <div>
              <h1 style="font-size:20px;font-weight:800;color:#db2777;margin:0 0 4px">${this.esc(this.t('vat_print_title'))}</h1>
              <p style="font-size:13px;color:#374151;font-weight:700;margin:0 0 2px">${this.esc(this.salonName)}</p>
              ${contactLine ? `<p style="font-size:11px;color:#6b7280;margin:0">${contactLine}</p>` : ''}
            </div>
          </div>
          <p style="font-size:11px;color:#9ca3af;margin:0 0 16px">${this.esc(this.t('vat_subtitle'))}</p>
          <table style="border-collapse:collapse;width:100%;margin-bottom:14px">
            <tbody>
              ${this.settings.vat_number ? sum(this.t('vat_reg_no'), this.esc(this.settings.vat_number)) : ''}
              ${sum(this.t('vat_print_period'), `${this.vat.from} → ${this.vat.to}`)}
              ${sum(this.t('vat_print_basis'), base)}
              ${sum(this.t('vat_print_rate'), (v.rate * 100).toFixed(1) + '%')}
              ${sum(this.t('vat_count'), String(v.count))}
            </tbody>
          </table>
          <table style="border-collapse:collapse;width:100%;margin-bottom:14px">
            <tbody>
              ${sum(this.t('gross_sales'), money(v.gross))}
              ${sum(this.t('net_taxable'), money(v.net))}
              ${sum(this.t('vat_collected'), money(v.vat))}
              ${sum(this.t('vat_input'), money(v.inputVat))}
              ${sum(this.t('vat_net_due'), money(v.netDue))}
            </tbody>
          </table>
          ${v.months.length ? `<table style="border-collapse:collapse;width:100%;margin-bottom:14px"><thead><tr><th style="${th};text-align:${rtl ? 'right' : 'left'}">${this.t('col_month')}</th><th style="${th}">${this.t('gross_sales')}</th><th style="${th}">${this.t('net_taxable')}</th><th style="${th}">${this.t('vat_collected')}</th><th style="${th}">${this.t('vat_input')}</th><th style="${th}">${this.t('vat_net_due')}</th></tr></thead><tbody>${monthRows}${totalRow}</tbody></table>` : ''}
          <p style="font-size:10px;color:#9ca3af;margin-top:12px">${this.t('vat_filing_note')} — ${this.t('vat_print_generated')}: ${new Date().toLocaleString(rtl ? 'ar-BH-u-nu-latn' : 'en-GB')}</p>
        </div>`
      window.print()
    }
  }))
})
