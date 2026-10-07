/**
 * 站点设置兜底（v3）
 * 数据库 settings/site 文档里任何字段都可能不存在（老数据兼容），
 * 统一在这里做空值兜底，页面直接用，永不为 undefined。
 */

const EMPTY_SITE = {
  siteName: '',
  logo: '',
  banners: [],
  contact: { phone: '', wechat: '', region: '', address: '' },
  about: { quote: '', introImage: '' },
  socialLinks: []
}

function str(v) {
  return (v === null || v === undefined) ? '' : String(v)
}

function normalizeSite(raw) {
  const s = raw || {}
  const contact = s.contact || {}
  const about = s.about || {}

  const banners = Array.isArray(s.banners) ? s.banners.filter(Boolean) : []

  const socialLinks = (Array.isArray(s.socialLinks) ? s.socialLinks : [])
    .filter(it => it && str(it.name).trim())
    .map((it, i) => ({
      // key 供 wx:for 使用，保证唯一（名称可能重复）
      key: 'sl' + i,
      name: str(it.name).trim(),
      value: str(it.value).trim(),
      // 圆圈内展示的简称
      short: str(it.name).trim().slice(0, 2)
    }))

  return {
    siteName: str(s.siteName).trim(),
    logo: str(s.logo),
    banners,
    contact: {
      phone: str(contact.phone).trim(),
      wechat: str(contact.wechat).trim(),
      region: str(contact.region).trim(),
      address: str(contact.address).trim()
    },
    about: {
      quote: str(about.quote).trim(),
      introImage: str(about.introImage)
    },
    socialLinks,
    // 预计算布尔量，避免 WXML 里写复杂表达式
    hasBanner: banners.length > 0,
    hasLogo: !!str(s.logo),
    hasQuote: !!str(about.quote).trim(),
    hasIntro: !!str(about.introImage),
    hasSocial: socialLinks.length > 0,
    hasContact: !!(str(contact.phone).trim() || str(contact.wechat).trim() ||
      str(contact.region).trim() || str(contact.address).trim())
  }
}

/** 空站点对象（页面初始 data 用，避免渲染时取到 undefined） */
function emptySite() {
  return JSON.parse(JSON.stringify(EMPTY_SITE))
}

module.exports = { normalizeSite, emptySite, EMPTY_SITE }
