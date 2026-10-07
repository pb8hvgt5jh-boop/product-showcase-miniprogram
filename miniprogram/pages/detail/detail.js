const app = getApp()
const db = wx.cloud.database()
const { decorateProduct } = require('../../utils/product.js')
const { emptySite } = require('../../utils/site.js')
const api = require('../../utils/api.js')

Page({
  data: {
    product: null,
    settings: emptySite(),
    loading: true
  },

  onLoad(options) {
    this.id = (options && options.id) || ''
    this.load()
  },

  async load() {
    const settings = await app.loadSettings()
    this.setData({ settings })
    let failed = settings._ok === false

    if (!this.id) { this.setData({ loading: false }); return }

    try {
      const res = await db.collection('products').doc(this.id).get()
      const p = decorateProduct(res.data)
      this.setData({ product: p, loading: false })
      wx.setNavigationBarTitle({ title: p.name || '产品详情' })
    } catch (e) {
      this.setData({ product: null, loading: false })
      // 产品确实不存在（-502004）是真·空态；
      // 其它错误是读取失败，不能显示成"产品不存在或已下架"糊弄过去
      if (!api.isNotFound(e)) failed = true
    }

    if (failed) {
      wx.showToast({ title: '加载失败，请重试', icon: 'none', duration: 2500 })
    }
  },

  previewImage(e) {
    const urls = (this.data.product && this.data.product._images) || []
    if (!urls.length) return
    wx.previewImage({ current: e.currentTarget.dataset.url, urls })
  },

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

  onShareAppMessage() {
    const p = this.data.product || {}
    const name = this.data.settings.siteName || 'MA玻璃瓶大全'
    return {
      title: p.name ? (p.name + ' · ' + name) : name,
      path: '/pages/detail/detail?id=' + (p._id || '')
    }
  },

  onShareTimeline() {
    const p = this.data.product || {}
    return { title: p.name || (this.data.settings.siteName || 'MA玻璃瓶大全') }
  }
})
