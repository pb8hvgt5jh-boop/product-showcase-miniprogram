const app = getApp()
const db = wx.cloud.database()
const api = require('../../utils/api.js')
const { pickOne, removeFiles } = require('../../utils/upload.js')

const MAX_BANNERS = 6

const EMPTY_FORM = {
  siteName: '', logo: '', banners: [],
  phone: '', wechat: '', region: '', address: '',
  quote: '', introImage: ''
}

Page({
  data: {
    loading: true,
    saving: false,
    loadFailed: false,
    maxBanners: MAX_BANNERS,
    form: Object.assign({}, EMPTY_FORM, { banners: [] }),
    socials: []
  },

  onLoad() { this.load() },
  onPullDownRefresh() { this.load(true) },
  retry() { this.load() },

  async load(fromPull) {
    try {
      const res = await db.collection('settings').doc('site').get()
      const s = res.data || {}
      const c = s.contact || {}
      const a = s.about || {}
      this.setData({
        raw: s,
        loadFailed: false,
        form: {
          siteName: s.siteName || '',
          logo: s.logo || '',
          banners: Array.isArray(s.banners) ? s.banners.filter(Boolean) : [],
          phone: c.phone || '',
          wechat: c.wechat || '',
          region: c.region || '',
          address: c.address || '',
          quote: a.quote || '',
          introImage: a.introImage || ''
        },
        socials: (Array.isArray(s.socialLinks) ? s.socialLinks : [])
          .map((it, i) => ({ _k: 's' + i, name: (it && it.name) || '', value: (it && it.value) || '' })),
        loading: false
      })
    } catch (e) {
      if (api.isNotFound(e)) {
        // 文档不存在：全新环境属于正常空态，用空表单，保存时由云函数 set 创建
        this.setData({ loadFailed: false, loading: false })
      } else {
        // 真正读失败：绝不能当成"还没有设置"渲染空表单。
        // 否则管理员一点保存，就会把云端已有配置整体覆盖成空白。
        // 这里改为停在错误态并暂停保存，等重新加载成功再放出保存入口。
        this.setData({ loadFailed: true, loading: false })
        wx.showToast({ title: '设置加载失败，请下拉重试', icon: 'none', duration: 2500 })
      }
    }
    if (fromPull) wx.stopPullDownRefresh()
  },

  /* ---------------- 文本字段 ---------------- */
  onField(e) {
    const f = e.currentTarget.dataset.field
    this.setData({ ['form.' + f]: e.detail.value })
  },

  /* ---------------- 通用图片操作 ---------------- */
  async pickInto(field, dir) {
    try {
      const fileID = await pickOne(dir)
      if (!fileID) return
      const old = this.data.form[field]
      this.setData({ ['form.' + field]: fileID })
      if (old) removeFiles(old)
      wx.showToast({ title: '已更新', icon: 'none' })
    } catch (e) {
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  clearImage(field) {
    const old = this.data.form[field]
    this.setData({ ['form.' + field]: '' })
    if (old) removeFiles(old)
    wx.showToast({ title: '已移除', icon: 'none' })
  },

  /* 品牌 Logo */
  logoAction() {
    const list = ['上传 / 更换 Logo']
    if (this.data.form.logo) list.push('移除 Logo')
    wx.showActionSheet({
      itemList: list, itemColor: '#d4a017',
      success: (r) => {
        if (r.tapIndex === 0) this.pickInto('logo', 'site')
        else if (r.tapIndex === 1) this.clearImage('logo')
      },
      fail: () => {}
    })
  },

  /* 品牌介绍长图 */
  introAction() {
    const list = ['上传 / 更换介绍长图']
    if (this.data.form.introImage) list.push('移除介绍长图')
    wx.showActionSheet({
      itemList: list, itemColor: '#d4a017',
      success: (r) => {
        if (r.tapIndex === 0) this.pickInto('introImage', 'site')
        else if (r.tapIndex === 1) this.clearImage('introImage')
      },
      fail: () => {}
    })
  },

  /* ---------------- 首页轮播图 ---------------- */
  async addBanner() {
    const banners = this.data.form.banners
    if (banners.length >= MAX_BANNERS) {
      wx.showToast({ title: '最多 ' + MAX_BANNERS + ' 张', icon: 'none' })
      return
    }
    try {
      const fileID = await pickOne('banners')
      if (!fileID) return
      this.setData({ 'form.banners': this.data.form.banners.concat(fileID) })
    } catch (e) {
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  bannerAction(e) {
    const i = Number(e.currentTarget.dataset.index)
    wx.showActionSheet({
      itemList: ['替换这张图', '删除这张图'], itemColor: '#d4a017',
      success: async (r) => {
        if (r.tapIndex === 0) {
          try {
            const fileID = await pickOne('banners')
            if (!fileID) return
            const banners = this.data.form.banners.slice()
            const old = banners[i]
            banners[i] = fileID
            this.setData({ 'form.banners': banners })
            if (old) removeFiles(old)
          } catch (err) {
            wx.showToast({ title: '上传失败', icon: 'none' })
          }
        } else if (r.tapIndex === 1) {
          const banners = this.data.form.banners.slice()
          const [gone] = banners.splice(i, 1)
          this.setData({ 'form.banners': banners })
          if (gone) removeFiles(gone)
        }
      },
      fail: () => {}
    })
  },

  moveBanner(e) {
    const i = Number(e.currentTarget.dataset.index)
    const dir = Number(e.currentTarget.dataset.dir)
    const j = i + dir
    const banners = this.data.form.banners.slice()
    if (j < 0 || j >= banners.length) return
    const tmp = banners[i]
    banners[i] = banners[j]
    banners[j] = tmp
    this.setData({ 'form.banners': banners })
  },

  /* ---------------- 社交链接 ---------------- */
  addSocial() {
    if (this.data.socials.length >= 6) {
      wx.showToast({ title: '最多 6 个', icon: 'none' })
      return
    }
    this.setData({
      socials: this.data.socials.concat([{ _k: 's' + Date.now(), name: '', value: '' }])
    })
  },

  onSocial(e) {
    const i = Number(e.currentTarget.dataset.index)
    const f = e.currentTarget.dataset.field
    const socials = this.data.socials.slice()
    socials[i] = Object.assign({}, socials[i], { [f]: e.detail.value })
    this.setData({ socials })
  },

  delSocial(e) {
    const i = Number(e.currentTarget.dataset.index)
    const socials = this.data.socials.slice()
    socials.splice(i, 1)
    this.setData({ socials })
  },

  /* ---------------- 保存 ---------------- */
  async save() {
    if (this.data.saving) return
    // 加载失败时表单是空的，此时保存会把云端已有配置覆盖成空白
    if (this.data.loadFailed) {
      wx.showToast({ title: '设置尚未加载成功，请下拉重试', icon: 'none', duration: 2500 })
      return
    }
    const f = this.data.form

    // 保留文档中未被表单管理的字段，避免老数据被覆盖丢失
    const raw = Object.assign({}, this.data.raw || {})
    delete raw._id
    delete raw._openid
    delete raw._cacheTime

    const data = Object.assign(raw, {
      siteName: (f.siteName || '').trim(),
      logo: f.logo || '',
      banners: f.banners || [],
      contact: {
        phone: (f.phone || '').trim(),
        wechat: (f.wechat || '').trim(),
        region: (f.region || '').trim(),
        address: (f.address || '').trim()
      },
      about: Object.assign({}, raw.about || {}, {
        quote: (f.quote || '').trim(),
        introImage: f.introImage || ''
      }),
      socialLinks: this.data.socials
        .filter(s => (s.name || '').trim())
        .map(s => ({ name: s.name.trim(), value: (s.value || '').trim() }))
    })

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中', mask: true })
    try {
      await api.saveSettings(data)
      this.setData({ raw: data })
      // 写成功后立即失效前台缓存，保证"保存即生效"而不是等 5 分钟自然过期
      await app.reloadSettings()
      wx.hideLoading()
      wx.showToast({ title: '已保存，即时生效' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '保存失败，请重试', icon: 'none', duration: 2500 })
    }
    this.setData({ saving: false })
  }
})
