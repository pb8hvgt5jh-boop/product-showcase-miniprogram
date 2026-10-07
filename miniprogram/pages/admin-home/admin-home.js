const adminUtil = require('../../utils/admin.js')

Page({
  data: { openid: '', isAdmin: false, ready: false },

  async onLoad() {
    // 进后台时强制复核一次，保证刚被加入白名单的人立刻能进
    const id = await adminUtil.refreshIdentity()
    this.setData({ openid: id.openid, isAdmin: id.isAdmin, ready: true })
    if (id.isAdmin) return

    // ok === false 是"没校验成功"，不是"不是管理员"。
    // 两者提示必须分开，否则网络故障会被误报成权限不足。
    wx.showModal({
      title: id.ok ? '无管理权限' : '身份校验失败',
      content: id.ok
        ? '当前微信不在管理员白名单内。请把下方 openid 加入 admins 集合后重试。'
        : '无法连接服务器校验身份，请检查网络后重新进入。',
      showCancel: false,
      confirmText: '返回',
      confirmColor: '#d4a017',
      success: () => wx.navigateBack()
    })
  },

  copyOpenid() {
    if (!this.data.openid) { wx.showToast({ title: '未获取到 openid', icon: 'none' }); return }
    wx.setClipboardData({ data: this.data.openid })
  },

  goProducts() { wx.navigateTo({ url: '/pages/admin-products/admin-products' }) },
  goCategories() { wx.navigateTo({ url: '/pages/admin-categories/admin-categories' }) },
  goSettings() { wx.navigateTo({ url: '/pages/admin-settings/admin-settings' }) },

  backHome() { wx.switchTab({ url: '/pages/index/index' }) }
})
