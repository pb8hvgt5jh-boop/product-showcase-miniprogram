const db = wx.cloud.database()
const api = require('../../utils/api.js')
const { pickAndUpload, removeFiles } = require('../../utils/upload.js')
const { statusIsOn } = require('../../utils/product.js')

const EMPTY_DLG = {
  show: false, mode: 'input', title: '', content: '',
  placeholder: '', initial: '', confirmText: '确定', danger: false
}

Page({
  data: {
    id: '',
    isEdit: false,
    cats: [],
    images: [],
    sheet: false,          // 分类选择弹层
    saving: false,
    dlg: Object.assign({}, EMPTY_DLG),
    form: {
      name: '',
      category: '',
      tags: '',
      description: '',
      status: 1
    }
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    this.setData({ id, isEdit: !!id })
    wx.setNavigationBarTitle({ title: id ? '编辑产品' : '新增产品' })
    this.loadCats().then(() => {
      if (id) this.loadProduct()
    })
  },

  async loadCats() {
    try {
      const res = await db.collection('categories').orderBy('sort', 'asc').limit(100).get()
      this.setData({ cats: res.data.map(c => c.name).filter(Boolean) })
    } catch (e) {
      // 不能静默变成"还没有分类"——那会让管理员以为分类丢了
      this.setData({ cats: [] })
      wx.showToast({ title: '分类加载失败，请重试', icon: 'none', duration: 2500 })
    }
  },

  async loadProduct() {
    try {
      const res = await db.collection('products').doc(this.data.id).get()
      const p = res.data || {}
      this.setData({
        images: Array.isArray(p.images) ? p.images.filter(Boolean) : [],
        form: {
          name: p.name || '',
          category: p.category || '',
          tags: (Array.isArray(p.tags) ? p.tags : []).join('，'),
          description: p.description || '',
          // 老数据缺 status 时视为上架，避免打开编辑页再保存就把产品误下架
          status: statusIsOn(p) ? 1 : 0
        }
      })
    } catch (e) {
      // 产品确实不存在 vs 读取失败，提示要分开
      wx.showToast({
        title: api.isNotFound(e) ? '产品不存在' : '产品加载失败，请重试',
        icon: 'none',
        duration: 2500
      })
    }
  },

  /* ---------------- 表单 ---------------- */
  onField(e) {
    const f = e.currentTarget.dataset.field
    this.setData({ ['form.' + f]: e.detail.value })
  },

  toggleStatus() {
    this.setData({ 'form.status': this.data.form.status ? 0 : 1 })
  },

  openSheet() { this.setData({ sheet: true }) },
  closeSheet() { this.setData({ sheet: false }) },
  noop() {},
  pickCat(e) {
    this.setData({ 'form.category': e.currentTarget.dataset.name || '', sheet: false })
  },

  /* ---------------- 图片 ---------------- */
  async addImages() {
    const left = 9 - this.data.images.length
    if (left <= 0) { wx.showToast({ title: '最多 9 张', icon: 'none' }); return }
    try {
      const list = await pickAndUpload('products', left)
      if (!list.length) return
      this.setData({ images: this.data.images.concat(list) })
    } catch (e) {
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  previewImage(e) {
    const urls = this.data.images
    if (!urls.length) return
    wx.previewImage({ current: urls[e.currentTarget.dataset.index], urls })
  },

  setCover(e) {
    const i = Number(e.currentTarget.dataset.index)
    if (i === 0) return
    const images = this.data.images.slice()
    const [pick] = images.splice(i, 1)
    images.unshift(pick)
    this.setData({ images })
    wx.showToast({ title: '已设为首图', icon: 'none' })
  },

  removeImage(e) {
    const i = Number(e.currentTarget.dataset.index)
    const images = this.data.images.slice()
    const [gone] = images.splice(i, 1)
    this.setData({ images })
    removeFiles(gone)
  },

  /* ---------------- 保存 ---------------- */
  async save() {
    if (this.data.saving) return
    const f = this.data.form
    const name = (f.name || '').trim()

    if (!name) { wx.showToast({ title: '请填写产品名称', icon: 'none' }); return }

    const data = {
      name,
      category: (f.category || '').trim(),
      description: (f.description || '').trim(),
      tags: (f.tags || '').split(/[，,]/).map(s => s.trim()).filter(Boolean),
      images: this.data.images,
      status: f.status ? 1 : 0
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中', mask: true })
    try {
      if (this.data.isEdit) {
        await api.updateProduct(this.data.id, data)
      } else {
        data.created_at = new Date().toISOString()
        await api.addProduct(data)
      }
      wx.hideLoading()
      wx.showToast({ title: '已保存，即时生效' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    }
  },

  /* ---------------- 删除 ---------------- */
  del() {
    this.setData({
      dlg: Object.assign({}, EMPTY_DLG, {
        show: true, mode: 'confirm', title: '删除产品',
        content: '确认删除「' + this.data.form.name + '」？删除后不可恢复。',
        confirmText: '删除', danger: true
      })
    })
  },
  onDlgCancel() { this.setData({ 'dlg.show': false }) },
  onDlgConfirm() {
    this.setData({ 'dlg.show': false })
    this.doDelete()
  },
  async doDelete() {
    if (!this.data.id) return
    wx.showLoading({ title: '删除中', mask: true })
    try {
      await api.deleteProduct(this.data.id)
      wx.hideLoading()
      removeFiles(this.data.images)
      wx.showToast({ title: '已删除' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '删除失败', icon: 'none' })
    }
  }
})
