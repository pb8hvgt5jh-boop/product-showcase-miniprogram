const db = wx.cloud.database()
const _ = db.command
const { decorateProducts, decorateCategory, visibleWhere } = require('../../utils/product.js')
const adminUtil = require('../../utils/admin.js')

const SORTS = [
  { key: 'default', label: '综合' }
]

Page({
  data: {
    sideList: [{ id: '__all__', name: '全部' }],
    activeIndex: 0,
    products: [],
    sortType: 'default',
    sorts: SORTS,
    catLoading: true,
    loading: true,
    isAdmin: false
  },

  onLoad() { this.loadCats() },
  onShow() {
    this.loadCats()
    adminUtil.isAdmin().then(v => {
      if (v !== this.data.isAdmin) this.setData({ isAdmin: v })
    })
  },

  async loadCats() {
    // 首页点击分类跳转过来时带的目标分类名
    let pending = ''
    try {
      pending = wx.getStorageSync('activeCategoryName') || ''
      if (pending) wx.removeStorageSync('activeCategoryName')
    } catch (e) { pending = '' }

    try {
      const res = await db.collection('categories').where(visibleWhere(_)).orderBy('sort', 'asc').limit(100).get()
      const cats = res.data.map(decorateCategory)
      const sideList = [{ id: '__all__', name: '全部' }]
        .concat(cats.map(c => ({ id: c._id, name: c._name })))

      let activeIndex = this.data.activeIndex
      if (pending) {
        const i = sideList.findIndex(s => s.name === pending)
        activeIndex = i >= 0 ? i : 0
      }
      if (activeIndex >= sideList.length) activeIndex = 0

      this.setData({ sideList, activeIndex, catLoading: false }, () => this.loadProducts())
    } catch (e) {
      this.setData({ catLoading: false, loading: false })
      wx.showToast({ title: '分类加载失败，请切换页面重试', icon: 'none', duration: 2500 })
    }
  },

  switchCategory(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (index === this.data.activeIndex) return
    this.setData({ activeIndex: index }, () => {
      this.loadProducts()
      wx.pageScrollTo({ scrollTop: 0, duration: 0 })
    })
  },

  changeSort(e) {
    const t = e.currentTarget.dataset.type
    if (t === this.data.sortType) return
    this.setData({ sortType: t }, () => this.loadProducts())
  },

  async loadProducts() {
    const cur = this.data.sideList[this.data.activeIndex] || { id: '__all__', name: '全部' }
    this.setData({ loading: true })
    try {
      const where = visibleWhere(_)
      if (cur.name !== '全部') where.category = cur.name

      const res = await db.collection('products').where(where).limit(100).get()
      this.setData({ products: decorateProducts(res.data), loading: false })
    } catch (e) {
      // 清空列表 + 提示，避免把上一次分类的产品留在屏幕上冒充当前分类结果
      this.setData({ products: [], loading: false })
      wx.showToast({ title: '产品加载失败，请重试', icon: 'none', duration: 2500 })
    }
  },

  goSearch() { wx.navigateTo({ url: '/pages/search/search' }) },
  goDetail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }) },
  goAdmin() { wx.navigateTo({ url: '/pages/admin-home/admin-home' }) },

  onShareAppMessage() { return { title: 'MA玻璃瓶大全 · 瓶型大全' } }
})
