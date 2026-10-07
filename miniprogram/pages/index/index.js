const app = getApp()
const db = wx.cloud.database()
const _ = db.command
const { decorateProducts, decorateCategory, visibleWhere } = require('../../utils/product.js')
const { emptySite } = require('../../utils/site.js')

Page({
  data: {
    settings: emptySite(),
    categories: [],
    hotProducts: [],
    bannerIndex: 0,
    loading: true,
    catLoading: true
  },

  onLoad() { this.loadAll() },
  onShow() { this.loadAll() },
  onPullDownRefresh() { this.loadAll(true) },

  async loadAll(force) {
    // 已有数据时不闪加载态（返回首页体验更顺）
    if (!this.data.categories.length) this.setData({ catLoading: true })
    if (!this.data.hotProducts.length) this.setData({ loading: true })

    const settings = await app.loadSettings(force)
    this.setData({ settings })

    // 站点设置读取失败也要出声，不能只剩空壳页面
    let failed = settings._ok === false

    try {
      // visibleWhere：status=1 或老数据缺 status 字段，都算可见
      const [catRes, proRes] = await Promise.all([
        db.collection('categories').where(visibleWhere(_)).orderBy('sort', 'asc').limit(100).get(),
        db.collection('products').where(visibleWhere(_)).orderBy('sales', 'desc').limit(20).get()
      ])
      this.setData({
        categories: catRes.data.map(decorateCategory),
        hotProducts: decorateProducts(proRes.data),
        loading: false,
        catLoading: false
      })
    } catch (e) {
      // 读失败：停在已有数据上，但明确提示可重试，不假装加载完成
      failed = true
      this.setData({ loading: false, catLoading: false })
    }

    if (failed) {
      wx.showToast({ title: '加载失败，请下拉重试', icon: 'none', duration: 2500 })
    }
    wx.stopPullDownRefresh()
  },

  /** 驱动自绘指示器（原生圆点已关闭） */
  onBannerChange(e) {
    const i = (e.detail && e.detail.current) || 0
    if (i !== this.data.bannerIndex) this.setData({ bannerIndex: i })
  },

  previewBanner(e) {
    wx.previewImage({ current: e.currentTarget.dataset.url, urls: this.data.settings.banners })
  },

  goSearch() { wx.navigateTo({ url: '/pages/search/search' }) },

  goCategory(e) {
    wx.setStorageSync('activeCategoryName', e.currentTarget.dataset.name)
    wx.switchTab({ url: '/pages/category/category' })
  },

  goDetail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }) },

  onShareAppMessage() {
    return { title: (this.data.settings.siteName || 'MA玻璃瓶大全') + ' · 玻璃瓶产品目录' }
  }
})
