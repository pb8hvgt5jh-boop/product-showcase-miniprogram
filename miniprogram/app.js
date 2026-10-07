const { normalizeSite } = require('./utils/site.js')
const { isNotFound } = require('./utils/api.js')
const { ENV_ID } = require('./utils/env.js')
// 同一会话内的复用窗口；冷启动一律绕过缓存重新拉取
const CACHE_MS = 5 * 60 * 1000

App({
  onLaunch() {
    wx.cloud.init({ env: ENV_ID, traceUser: true })
    // 冷启动强制拉一次：否则本地那份可能已过期的设置会继续被当成最新数据使用
    this.loadSettings(true)
    // 预热 openid / 管理员身份（不阻塞渲染）
    require('./utils/admin.js').ensureIdentity()
  },

  globalData: {
    openid: null,
    isAdmin: false,
    adminChecked: false,
    adminAt: 0,
    settings: null,
    settingsError: false
  },

  /**
   * 全局加载站点设置
   * 返回值永远是一个「已兜底」的对象，字段缺失时不会让页面报错；
   * 额外附带两个状态位：
   *   _ok    === false 表示本次读取失败（用的是回退数据或空数据）
   *   _stale === true  表示当前返回的是上次成功的旧数据
   * 页面据此提示用户，而不是静默地停在旧数据上装作没事。
   */
  async loadSettings(force) {
    let cached = null
    try { cached = wx.getStorageSync('siteSettings') } catch (e) { cached = null }
    const fresh = !!(cached && cached._cacheTime && (Date.now() - cached._cacheTime) < CACHE_MS)

    if (!force && fresh) {
      return this._commit(normalizeSite(cached), true, false)
    }

    try {
      const db = wx.cloud.database()
      const res = await db.collection('settings').doc('site').get()
      const raw = res.data || {}
      raw._cacheTime = Date.now()
      try { wx.setStorageSync('siteSettings', raw) } catch (e) {}
      return this._commit(normalizeSite(raw), true, false)
    } catch (e) {
      // 文档确实不存在 ≠ 读取失败：全新环境属于正常空态，不该报错
      if (isNotFound(e)) {
        return this._commit(normalizeSite(null), true, false)
      }
      // 真正读失败：优先回退到上次成功的数据（避免整页空白），
      // 但把 _ok 带出去让页面提示，而不是假装一切正常
      return this._commit(cached ? normalizeSite(cached) : normalizeSite(null), false, !!cached)
    }
  },

  /** 统一写入 globalData，避免三处分支各写一遍漏掉状态位 */
  _commit(s, ok, stale) {
    s._ok = ok
    s._stale = stale
    this.globalData.settings = s
    this.globalData.settingsError = !ok
    return s
  },

  /** 清缓存并重新拉取（后台保存后调用，保证"保存即生效"） */
  async reloadSettings() {
    try { wx.removeStorageSync('siteSettings') } catch (e) {}
    return this.loadSettings(true)
  }
})
