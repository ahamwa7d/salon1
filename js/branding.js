/*
 * Shared public branding loader.
 *
 * Every public page (landing, privacy, terms, usage) reads its name, logo,
 * phone, address, social links and legal text from the same Supabase
 * settings, so changing a value once in the admin dashboard updates the whole
 * site. This file is intentionally dependency-free: it talks to the Supabase
 * REST API with fetch(), so it also works when the app bundle is not loaded.
 */
(function () {
  'use strict'

  var cfg = window.APP_CONFIG || {}
  var lang = 'ar'
  try { lang = localStorage.getItem('salon_lang') || 'ar' } catch (_e) { /* ignore */ }

  var info = {}
  var page = null

  function isPlaceholder(value) {
    var v = String(value == null ? '' : value).trim()
    return !v || v === '%%SUPABASE_URL%%' || v === '%%SUPABASE_ANON_KEY%%' ||
      v === '%%SALON_NAME%%' || v.indexOf('YOUR-') !== -1
  }

  function configured() {
    return !isPlaceholder(cfg.SUPABASE_URL) && !isPlaceholder(cfg.SUPABASE_ANON_KEY)
  }

  function configName() {
    return isPlaceholder(cfg.SALON_NAME) ? '' : String(cfg.SALON_NAME).trim()
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    })
  }

  function has(value) {
    return String(value == null ? '' : value).trim() !== ''
  }

  // Name priority: what the manager saved in the dashboard, then the name the
  // installer wrote into config.js, then a neutral label.
  function brand() {
    if (has(info.salon_name)) return info.salon_name
    return configName() || (lang === 'ar' ? 'الصالون' : 'Salon')
  }

  function rpc(fn, body) {
    var url = String(cfg.SUPABASE_URL).replace(/\/+$/, '') + '/rest/v1/rpc/' + fn
    return fetch(url, {
      method: 'POST',
      headers: {
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      if (!res.ok) throw new Error('rpc_' + res.status)
      return res.json()
    })
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = has(value) ? value : ''
    })
  }

  function toggleOptional(selector, show) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.classList.toggle('hidden', !show)
    })
  }

  function setLink(selector, href) {
    document.querySelectorAll(selector).forEach(function (el) {
      if (has(href)) el.setAttribute('href', href)
    })
  }

  var SOCIAL = [
    { key: 'social_whatsapp', label: 'WhatsApp', icon: 'i-whatsapp' },
    { key: 'social_instagram', label: 'Instagram', icon: 'i-instagram' },
    { key: 'social_tiktok', label: 'TikTok', icon: 'i-tiktok' },
    { key: 'social_snapchat', label: 'Snapchat', icon: 'i-snapchat' },
    { key: 'social_facebook', label: 'Facebook', icon: 'i-facebook' },
    { key: 'social_x', label: 'X', icon: 'i-x-social' },
    { key: 'social_youtube', label: 'YouTube', icon: 'i-youtube' }
  ]

  function socialUrl(key, value) {
    if (!has(value)) return ''
    var v = String(value).trim()
    if (key === 'social_whatsapp' && /^[+\d]/.test(v)) {
      return 'https://wa.me/' + v.replace(/\D/g, '')
    }
    if (!/^https?:\/\//i.test(v)) return 'https://' + v.replace(/^\/+/, '')
    return v
  }

  function renderSocial() {
    var hosts = document.querySelectorAll('[data-social-links]')
    if (!hosts.length) return
    var links = SOCIAL.map(function (s) {
      return { label: s.label, icon: s.icon, url: socialUrl(s.key, info[s.key]) }
    }).filter(function (s) { return s.url })

    hosts.forEach(function (host) {
      host.innerHTML = links.map(function (s) {
        return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + esc(s.label) + '" aria-label="' + esc(s.label) + '" class="grid h-9 w-9 place-items-center rounded-xl bg-white text-pink-700 ring-1 ring-pink-100 transition hover:bg-pink-50">' +
          '<svg class="h-4 w-4"><use href="#' + s.icon + '"></use></svg></a>'
      }).join('')
      host.classList.toggle('hidden', !links.length)
    })
  }

  function placeholders(text) {
    if (!has(text)) return ''
    var values = {
      salon_name: esc(info.salon_name || ''),
      phone: esc(info.salon_phone || '—'),
      address: esc(info.salon_address || '—'),
      email: esc(info.salon_email || '—'),
      hours: esc(info.salon_hours || '—'),
      map_url: esc(info.map_url || '#'),
      website: esc(location.origin + location.pathname.replace(/[^/]*$/, ''))
    }
    return String(text).replace(/\{(salon_name|phone|address|email|hours|map_url|website)\}/g, function (_m, key) {
      return values[key] == null ? '' : values[key]
    })
  }

  // The legal text is HTML authored by the salon manager (trusted), but it is
  // still passed through a small allow-list filter so a pasted <script> or an
  // inline event handler can never run on the public page.
  function sanitize(html) {
    if (!has(html)) return ''
    var doc = new DOMParser().parseFromString('<div id="root">' + html + '</div>', 'text/html')
    var root = doc.getElementById('root')
    if (!root) return ''

    root.querySelectorAll('script, style, iframe, object, embed, link, meta, form, input, button, textarea, select').forEach(function (el) {
      el.parentNode.removeChild(el)
    })

    root.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (attr) {
        var name = attr.name.toLowerCase()
        var value = String(attr.value || '')
        if (name.indexOf('on') === 0) {
          el.removeAttribute(attr.name)
          return
        }
        if ((name === 'href' || name === 'src' || name === 'xlink:href') && /^\s*javascript:/i.test(value)) {
          el.removeAttribute(attr.name)
        }
        if (name === 'style' && /expression\s*\(|url\s*\(\s*['"]?\s*javascript:/i.test(value)) {
          el.removeAttribute(attr.name)
        }
      })
    })

    return root.innerHTML
  }

  function fillLegal() {
    if (!page) return
    var isAr = lang === 'ar'
    var title = isAr ? page.title_ar : page.title_en
    var intro = isAr ? page.intro_ar : page.intro_en
    var body = isAr ? page.body_ar : page.body_en

    setText('[data-legal-title]', title || '')
    setText('[data-legal-intro]', intro || '')
    setText('[data-legal-updated]', page.updated_at ? formatDate(page.updated_at) : '')
    toggleOptional('[data-legal-updated-row]', Boolean(page.updated_at))

    var bodyHost = document.querySelector(isAr ? '[data-legal-body-ar]' : '[data-legal-body-en]')
    if (bodyHost) {
      var html = sanitize(placeholders(body || ''))
      if (html) bodyHost.innerHTML = html
    }

    var titleHosts = document.querySelectorAll('[data-legal-heading]')
    titleHosts.forEach(function (el) {
      el.textContent = (isAr ? page.title_ar : page.title_en) || ''
    })

    applyMeta(title || shellHeading())
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleDateString(lang === 'ar' ? 'ar-BH-u-nu-latn' : 'en-GB', {
        year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bahrain'
      })
    } catch (_e) {
      return String(value || '').slice(0, 10)
    }
  }

  // The heading authored in the HTML shell (e.g. "Privacy Policy") so the tab
  // title stays meaningful even when the database has no page content yet.
  function shellHeading() {
    var el = document.querySelector((lang === 'ar' ? '.lang-ar ' : '.lang-en ') + '[data-legal-title]')
    var text = el ? String(el.textContent || '').trim() : ''
    if (has(text)) return text
    return lang === 'ar' ? 'معلومات قانونية' : 'Legal information'
  }

  function applyMeta(pageTitle) {
    var isAr = lang === 'ar'
    var brandName = brand()
    var seoTitle = isAr ? info.seo_title_ar : info.seo_title_en
    var seoDesc = isAr ? info.seo_description_ar : info.seo_description_en

    document.title = has(seoTitle)
      ? pageTitle + ' · ' + seoTitle
      : pageTitle + ' · ' + brandName

    if (has(seoDesc)) {
      var meta = document.querySelector('meta[name="description"]')
      if (meta) meta.setAttribute('content', seoDesc)
    }

    var ogSite = document.querySelector('meta[property="og:site_name"]')
    if (ogSite) ogSite.setAttribute('content', brandName)
    var ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) ogTitle.setAttribute('content', document.title)
    var twitterTitle = document.querySelector('meta[name="twitter:title"]')
    if (twitterTitle) twitterTitle.setAttribute('content', document.title)

    if (has(info.logo_url)) {
      var icon = document.querySelector('link[rel="icon"]')
      if (icon) icon.setAttribute('href', info.logo_url)
      var appleIcon = document.querySelector('link[rel="apple-touch-icon"]')
      if (appleIcon) appleIcon.setAttribute('href', info.logo_url)
      var ogImage = document.querySelector('meta[property="og:image"]')
      if (ogImage) ogImage.setAttribute('content', info.logo_url)
      var twitterImage = document.querySelector('meta[name="twitter:image"]')
      if (twitterImage) twitterImage.setAttribute('content', info.logo_url)
    }

    if (has(info.salon_name)) {
      var appName = document.querySelector('meta[name="application-name"]')
      if (appName) appName.setAttribute('content', brandName)
      var appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
      if (appleTitle) appleTitle.setAttribute('content', brandName)
    }
  }

  function applyInfo() {
    var brandName = brand()
    setText('[data-brand-name]', brandName)

    var tagline = lang === 'ar' ? info.tagline_ar : info.tagline_en
    setText('[data-brand-tagline]', tagline || '')
    toggleOptional('[data-brand-tagline]', has(tagline))

    var logos = document.querySelectorAll('[data-brand-logo]')
    if (logos.length) {
      var hasLogo = has(info.logo_url)
      logos.forEach(function (img) {
        if (hasLogo) {
          img.setAttribute('src', info.logo_url)
          img.setAttribute('alt', brandName || 'Logo')
          img.classList.remove('hidden')
        } else {
          img.classList.add('hidden')
        }
      })
      toggleOptional('[data-brand-mark]', !hasLogo)
    }

    var phone = info.salon_phone || ''
    setText('[data-contact-phone]', phone)
    toggleOptional('[data-contact-phone-block]', has(phone))
    if (has(phone)) {
      setLink('[data-contact-phone-link]', 'tel:' + phone.replace(/\s+/g, ''))
      setLink('[data-contact-wa]', 'https://wa.me/' + phone.replace(/\D/g, ''))
    }

    setText('[data-contact-email]', info.salon_email || '')
    toggleOptional('[data-contact-email-block]', has(info.salon_email))
    if (has(info.salon_email)) setLink('[data-contact-email-link]', 'mailto:' + info.salon_email)

    setText('[data-contact-address]', info.salon_address || '')
    toggleOptional('[data-contact-address-block]', has(info.salon_address))
    if (has(info.map_url)) setLink('[data-contact-map]', info.map_url)

    setText('[data-contact-hours]', info.salon_hours || '')
    toggleOptional('[data-contact-hours-block]', has(info.salon_hours))

    // Page headings / footer that mention the brand.
    document.querySelectorAll('[data-brand-year]').forEach(function (el) {
      el.textContent = new Date().getFullYear()
    })

    renderSocial()
    if (page) fillLegal()
    else {
      toggleOptional('[data-legal-updated-row]', false)
      applyMeta(shellHeading())
    }
  }

  // Called again by the language buttons after they switch the DOM language.
  window.applyBrandLanguage = function (nextLang) {
    lang = nextLang === 'en' ? 'en' : 'ar'
    applyInfo()
  }

  function load() {
    if (!configured()) {
      applyMeta(shellHeading())
      return
    }

    var slug = document.body.getAttribute('data-legal-page')
    var infoJob = rpc('public_info').catch(function () { return null })
    var pageJob = slug
      ? rpc('public_legal_page', { p_slug: slug }).catch(function () { return null })
      : Promise.resolve(null)

    Promise.all([infoJob, pageJob]).then(function (results) {
      var rows = results[0]
      if (rows && rows.length) info = rows[0] || {}
      if (slug && results[1] && results[1].length) page = results[1][0]
      applyInfo()
      if (slug && !page) showPageFallback()
    }).catch(function () {
      // Keep the static shell usable; contact data simply stays as authored.
      applyMeta(shellHeading())
      if (slug) showPageFallback()
    })
  }

  // A clear message (instead of a permanent "loading" line) when the database
  // has not been set up yet or the page content is missing.
  function showPageFallback() {
    var contact = [info.salon_phone, info.salon_email].filter(has).map(esc)
    var messageAr = contact.length
      ? 'تعذّر تحميل هذه الصفحة حاليًا. يمكنك التواصل معنا على ' + contact.join(' أو ') + '، وسنوافيك بالتفاصيل.'
      : 'تعذّر تحميل هذه الصفحة حاليًا. يرجى المحاولة لاحقًا أو التواصل معنا عبر الموقع.'
    var messageEn = contact.length
      ? 'This page could not be loaded right now. Please contact us on ' + contact.join(' or ') + ' and we will be happy to help.'
      : 'This page could not be loaded right now. Please try again later or reach us through the site.'
    var ar = document.querySelector('[data-legal-body-ar]')
    var en = document.querySelector('[data-legal-body-en]')
    if (ar) ar.innerHTML = '<section class="card p-5"><p>' + messageAr + '</p></section>'
    if (en) en.innerHTML = '<section class="card p-5"><p>' + messageEn + '</p></section>'
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load)
  } else {
    load()
  }
})()
