const app = getApp()
const adminUtil = require('../../utils/admin.js')
const { emptySite } = require('../../utils/site.js')

const TAP_TARGET = 5
const TAP_RESET_MS = 1600

Page({
  data: {
    settings: emptySite(),
    loading: true,
    isAdmin: false,
    openid: ''
  },

  onShow() { this.load() },

  async load() {
    const settings = await app.loadSettings()
    this.setData({ settings, loading: false })
    // ensureIdentity 内部走 login 云函数取 openid，已有缓存不会重复请求
    const id = await adminUtil.ensureIdentity()
    this.setData({ isAdmin: !!id.isAdmin, openid: id.openid || '' })

    if (settings._ok === false) {
      wx.showToast({ title: '站点信息加载失败，请重试', icon: 'none', duration: 2500 })
    }
  },

  /* ---------- 品牌区：连点 5 次进入管理后台 ---------- */
  onBrandTap() {
    const now = Date.now()
    if (now - (this._lastTap || 0) > TAP_RESET_MS) this._taps = 0
    this._lastTap = now
    this._taps = (this._taps || 0) + 1

    const left = TAP_TARGET - this._taps
    if (left > 0 && left <= 2) {
      wx.showToast({ title: '再点 ' + left + ' 次进入后台', icon: 'none' })
    }
    if (this._taps >= TAP_TARGET) {
      this._taps = 0
      this.goAdmin()
    }
  },

  async goAdmin() {
    if (!this.data.isAdmin) {
      // 本地那份"不是管理员"的结论可能刚失效（比如刚被加进白名单），
      // 这里强制复核一次，避免用户被旧缓存挡在门外
      const id = await adminUtil.refreshIdentity()
      this.setData({ isAdmin: !!id.isAdmin, openid: id.openid || '' })
      if (!id.isAdmin) {
        wx.showToast({
          title: id.ok ? '无管理权限' : '身份校验失败，请重试',
          icon: 'none',
          duration: 2500
        })
        return
      }
    }
    wx.navigateTo({ url: '/pages/admin-home/admin-home' })
  },

  /* ---------- 用户 ID（所有访客可见，点击复制） ---------- */
  copyOpenid() {
    const openid = this.data.openid
    if (!openid) { wx.showToast({ title: 'ID 获取中，请稍后重试', icon: 'none' }); return }
    wx.setClipboardData({ data: openid })
  },

  /* ---------- 四个圆形按钮 ---------- */
  callPhone() {
    const phone = this.data.settings.contact.phone
    if (!phone) { wx.showToast({ title: '暂未设置联系电话', icon: 'none' }); return }
    wx.makePhoneCall({ phoneNumber: phone, fail: () => {} })
  },

  copyWechat() {
    const wechat = this.data.settings.contact.wechat
    if (!wechat) { wx.showToast({ title: '暂未设置微信号', icon: 'none' }); return }
    wx.setClipboardData({ data: wechat })
  },

  showAddress() {
    const c = this.data.settings.contact
    const text = [c.region, c.address].filter(Boolean).join('\n')
    if (!text) { wx.showToast({ title: '暂未设置地址', icon: 'none' }); return }
    wx.showModal({
      title: '地址',
      content: text,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#d4a017'
    })
  },

  /* ---------- 社交链接：点击复制 ---------- */
  copySocial(e) {
    const v = e.currentTarget.dataset.value
    if (!v) { wx.showToast({ title: '未填写内容', icon: 'none' }); return }
    wx.setClipboardData({ data: v })
  },

  previewIntro() {
    const img = this.data.settings.about.introImage
    if (!img) return
    wx.previewImage({ current: img, urls: [img] })
  },

  onShareAppMessage() {
    const s = this.data.settings
    return {
      title: (s.siteName || 'MA玻璃瓶大全') + (s.about.quote ? ' · ' + s.about.quote : ''),
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return { title: this.data.settings.siteName || 'MA玻璃瓶大全' }
  }
})
