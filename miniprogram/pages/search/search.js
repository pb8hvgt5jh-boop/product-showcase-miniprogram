const db = wx.cloud.database()
const _ = db.command
const { decorateProducts, decorateCategory, visibleWhere } = require('../../utils/product.js')

const SORTS = [
  { key: 'default', label: '综合' }
]

Page({
  data: {
    keyword: '',
    history: [],
    hotWords: [],
    results: [],
    resultCount: 0,
    searched: false,
    searching: false,
    sortType: 'default',
    sorts: SORTS,
    autoFocus: false
  },

  onLoad() {
    this.setData({ autoFocus: true })
    this.loadHotWords()
  },

  onShow() {
    try { this.setData({ history: wx.getStorageSync('searchHistory') || [] }) } catch (e) {}
  },

  async loadHotWords() {
    try {
      const res = await db.collection('categories').where(visibleWhere(_)).orderBy('sort', 'asc').limit(12).get()
      this.setData({ hotWords: res.data.map(decorateCategory).map(c => c._name) })
    } catch (e) { this.setData({ hotWords: [] }) }
  },

  onInput(e) { this.setData({ keyword: e.detail.value }) },
  onClear() { this.setData({ keyword: '', searched: false, results: [], resultCount: 0 }) },

  async doSearch() {
    const kw = (this.data.keyword || '').trim()
    if (!kw) { wx.showToast({ title: '请输入关键词', icon: 'none' }); return }

    let history = this.data.history.filter(h => h !== kw)
    history.unshift(kw)
    history = history.slice(0, 10)
    try { wx.setStorageSync('searchHistory', history) } catch (e) {}

    this.setData({ history, searched: true, sortType: 'default' }, () => this.query())
  },

  searchAgain(e) {
    this.setData({ keyword: e.currentTarget.dataset.kw }, () => this.doSearch())
  },

  clearHistory() {
    wx.showModal({
      title: '清空搜索历史',
      content: '确定清空全部搜索记录？',
      confirmColor: '#d4a017',
      success: (r) => {
        if (!r.confirm) return
        try { wx.removeStorageSync('searchHistory') } catch (e) {}
        this.setData({ history: [] })
      }
    })
  },

  changeSort(e) {
    const t = e.currentTarget.dataset.type
    if (t === this.data.sortType) return
    this.setData({ sortType: t }, () => this.query())
  },

  async query() {
    const kw = (this.data.keyword || '').trim()
    if (!kw) return
    this.setData({ searching: true })

    const reg = db.RegExp({ regexp: kw, options: 'i' })

    let data = []
    let failed = false
    try {
      // 名称 / 分类 / 标签 三处命中（可见条件兼容老数据缺 status 字段）
      const q = db.collection('products').where(_.and([
        visibleWhere(_),
        _.or([{ name: reg }, { category: reg }, { tags: reg }])
      ]))
      const res = await q.limit(100).get()
      data = res.data
    } catch (e) {
      // 兜底：老库若对 tags 数组的正则匹配不支持，退回只搜名称
      try {
        const q2 = db.collection('products').where(Object.assign(visibleWhere(_), { name: reg }))
        const res2 = await q2.limit(100).get()
        data = res2.data
      } catch (e2) {
        // 两条查询都失败 = 真的读不到。
        // 这种情况必须提示，否则会显示成"没有找到相关产品"，把故障说成业务结果。
        data = []
        failed = true
      }
    }

    this.setData({
      results: decorateProducts(data),
      resultCount: data.length,
      searching: false
    })

    if (failed) {
      wx.showToast({ title: '搜索失败，请重试', icon: 'none', duration: 2500 })
    }
  },

  goDetail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }) },

  onShareAppMessage() { return { title: 'MA玻璃瓶大全 · 瓶型搜索' } }
})
