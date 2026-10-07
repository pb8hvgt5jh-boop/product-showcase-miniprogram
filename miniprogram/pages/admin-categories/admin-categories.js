const db = wx.cloud.database()
const api = require('../../utils/api.js')
const { pickOne, removeFiles } = require('../../utils/upload.js')
const { decorateCategory } = require('../../utils/product.js')

const EMPTY_DLG = {
  show: false, mode: 'input', title: '', content: '',
  placeholder: '', initial: '', confirmText: '确定', danger: false
}

Page({
  data: {
    cats: [],
    loading: true,
    dlg: Object.assign({}, EMPTY_DLG)
  },

  onLoad() { this.load() },
  onShow() { this.load() },

  async load() {
    this.setData({ loading: true })
    try {
      const res = await db.collection('categories').orderBy('sort', 'asc').limit(100).get()
      this.setData({ cats: res.data.map(decorateCategory), loading: false })
    } catch (e) {
      this.setData({ cats: [], loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /* ---------------- 弹窗 ---------------- */
  openDlg(cfg, action, target) {
    this._action = action
    this._target = target || null
    this.setData({ dlg: Object.assign({}, EMPTY_DLG, cfg, { show: true }) })
  },
  closeDlg() { this.setData({ 'dlg.show': false }) },
  onDlgConfirm(e) {
    const value = (e.detail && e.detail.value) || ''
    const action = this._action
    this.closeDlg()
    if (action === 'add') this.doAdd(value)
    else if (action === 'rename') this.doRename(value)
    else if (action === 'delete') this.doDelete()
  },
  onDlgCancel() { this.closeDlg() },

  /* ---------------- 新增 ---------------- */
  add() {
    this.openDlg({
      mode: 'input', title: '新增分类',
      placeholder: '分类名称，如：喜宴瓶',
      confirmText: '添加'
    }, 'add')
  },

  async doAdd(name) {
    if (!name) { wx.showToast({ title: '请输入分类名称', icon: 'none' }); return }
    const maxSort = this.data.cats.reduce((m, c) => Math.max(m, c._sort || 0), 0)
    wx.showLoading({ title: '添加中', mask: true })
    try {
      await api.addCategory({ name, sort: maxSort + 10, status: 1, image: '' })
      wx.hideLoading()
      wx.showToast({ title: '已添加' })
      this.load()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '添加失败', icon: 'none' })
    }
  },

  /* ---------------- 重命名 ---------------- */
  rename(e) {
    const item = e.currentTarget.dataset.item
    this.openDlg({
      mode: 'input', title: '重命名分类',
      initial: item._name, placeholder: '分类名称',
      confirmText: '保存'
    }, 'rename', item)
  },

  async doRename(name) {
    const item = this._target
    if (!item) return
    if (!name) { wx.showToast({ title: '请输入分类名称', icon: 'none' }); return }
    if (name === item._name) return

    wx.showLoading({ title: '保存中', mask: true })
    try {
      // 云函数内一并同步该分类下产品的 category 字段，避免产品从分类里"消失"
      await api.renameCategory(item._id, name)
      wx.hideLoading()
      wx.showToast({ title: '已重命名' })
      this.load()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    }
  },

  /* ---------------- 封面图 ---------------- */
  cover(e) {
    const item = e.currentTarget.dataset.item
    const list = ['上传 / 更换封面图']
    if (item._hasCover) list.push('移除封面图')
    wx.showActionSheet({
      itemList: list,
      itemColor: '#d4a017',
      success: (r) => {
        if (r.tapIndex === 0) this.doUploadCover(item)
        else if (r.tapIndex === 1) this.doRemoveCover(item)
      },
      fail: () => {}
    })
  },

  async doUploadCover(item) {
    try {
      const fileID = await pickOne('categories')
      if (!fileID) return
      wx.showLoading({ title: '保存中', mask: true })
      await api.updateCategory(item._id, { image: fileID })
      wx.hideLoading()
      if (item._cover) removeFiles(item._cover)
      wx.showToast({ title: '已更新封面' })
      this.load()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  async doRemoveCover(item) {
    wx.showLoading({ title: '保存中', mask: true })
    try {
      await api.updateCategory(item._id, { image: '' })
      wx.hideLoading()
      if (item._cover) removeFiles(item._cover)
      this.load()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  /* ---------------- 排序（上移 / 下移） ---------------- */
  async move(e) {
    const index = Number(e.currentTarget.dataset.index)
    const dir = Number(e.currentTarget.dataset.dir)
    const target = index + dir
    const list = this.data.cats.slice()
    if (target < 0 || target >= list.length) return

    const tmp = list[index]
    list[index] = list[target]
    list[target] = tmp

    // 按新顺序重新编号，保证 sort 唯一且递增
    const order = list.map((c, i) => ({ id: c._id, sort: (i + 1) * 10 }))

    wx.showLoading({ title: '保存中', mask: true })
    try {
      await api.saveCategoryOrder(order)
      wx.hideLoading()
      this.load()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '排序失败', icon: 'none' })
    }
  },

  /* ---------------- 显示 / 隐藏 ---------------- */
  async toggle(e) {
    const item = e.currentTarget.dataset.item
    try {
      await api.updateCategory(item._id, { status: item._visible ? 0 : 1 })
      wx.showToast({ title: item._visible ? '已隐藏' : '已显示' })
      this.load()
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  /* ---------------- 删除 ---------------- */
  del(e) {
    const item = e.currentTarget.dataset.item
    this.openDlg({
      mode: 'confirm', title: '删除分类',
      content: '确认删除「' + item._name + '」？该分类下的产品不会被删除，但分类页将不再显示该分类。',
      confirmText: '删除', danger: true
    }, 'delete', item)
  },

  async doDelete() {
    const item = this._target
    if (!item) return
    wx.showLoading({ title: '删除中', mask: true })
    try {
      await api.deleteCategory(item._id)
      wx.hideLoading()
      if (item._cover) removeFiles(item._cover)
      wx.showToast({ title: '已删除' })
      this.load()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '删除失败', icon: 'none' })
    }
  }
})
