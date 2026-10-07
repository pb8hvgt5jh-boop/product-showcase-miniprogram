const db = wx.cloud.database()
const api = require('../../utils/api.js')
const { decorateProducts } = require('../../utils/product.js')
const { removeFiles } = require('../../utils/upload.js')

const EMPTY_DLG = {
  show: false, mode: 'input', title: '', content: '',
  placeholder: '', initial: '', confirmText: '确定', danger: false
}

Page({
  data: {
    products: [],
    keyword: '',
    loading: true,
    dlg: Object.assign({}, EMPTY_DLG)
  },

  onShow() { this.load() },

  onSearchInput(e) { this.setData({ keyword: e.detail.value }) },
  onSearchConfirm() { this.load() },
  clearSearch() { this.setData({ keyword: '' }, () => this.load()) },

  async load() {
    this.setData({ loading: true })
    const kw = (this.data.keyword || '').trim()
    try {
      let q
      if (kw) {
        q = db.collection('products').where({ name: db.RegExp({ regexp: kw, options: 'i' }) })
      } else {
        q = db.collection('products').orderBy('created_at', 'desc')
      }
      let res
      try {
        res = await q.limit(100).get()
      } catch (e) {
        // 老数据若缺 created_at 字段导致排序异常，退回默认顺序
        res = await db.collection('products').limit(100).get()
      }
      this.setData({ products: decorateProducts(res.data), loading: false })
    } catch (e) {
      this.setData({ products: [], loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  goAdd() { wx.navigateTo({ url: '/pages/admin-product-edit/admin-product-edit' }) },
  goEdit(e) { wx.navigateTo({ url: '/pages/admin-product-edit/admin-product-edit?id=' + e.currentTarget.dataset.id }) },

  /* ---------------- 上下架 ---------------- */
  async toggleStatus(e) {
    const item = e.currentTarget.dataset.item
    try {
      await api.updateProduct(item._id, { status: item._statusOn ? 0 : 1 })
      wx.showToast({ title: item._statusOn ? '已下架' : '已上架' })
      this.load()
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' })
    }
  },

  /* ---------------- 删除 ---------------- */
  del(e) {
    const item = e.currentTarget.dataset.item
    this._target = item
    this.setData({
      dlg: Object.assign({}, EMPTY_DLG, {
        show: true, mode: 'confirm', title: '删除产品',
        content: '确认删除「' + item.name + '」？删除后不可恢复。',
        confirmText: '删除', danger: true
      })
    })
  },

  onDlgConfirm() {
    this.setData({ 'dlg.show': false })
    this.doDelete()
  },
  onDlgCancel() { this.setData({ 'dlg.show': false }) },

  async doDelete() {
    const item = this._target
    if (!item) return
    wx.showLoading({ title: '删除中', mask: true })
    try {
      await api.deleteProduct(item._id)
      wx.hideLoading()
      removeFiles(item._images)
      wx.showToast({ title: '已删除' })
      this.load()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '删除失败', icon: 'none' })
    }
  }
})
