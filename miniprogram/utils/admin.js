/**
 * 管理员身份（v3）
 * 通过 login 云函数取 openid，再问 adminApi.check 是否在白名单里。
 *
 * 缓存策略（每一条都是为了避免"旧结论卡住新权限"）：
 *  - openid 终身不变            → 可以长期复用，省掉一次 login 调用
 *  - isAdmin === true           → 允许持久缓存（跨冷启动有效）
 *  - isAdmin === false          → 不落盘，只在内存保留 5 分钟
 *      否则用户被加进 admins 白名单后，会一直被本地那份"不是管理员"的旧结论挡住
 *  - 校验请求本身失败           → 不写任何缓存，下次调用自动重试
 *      绝不能把"查不动"当成"不是管理员"
 */

const KEY = 'maIdentity'
const DENY_TTL = 5 * 60 * 1000

function getApp_() {
  // 兼容页面/组件不同调用时机
  try { return getApp() } catch (e) { return null }
}

/** 读取持久化的「肯定」结论（只有 isAdmin === true 才会落盘） */
function readGranted() {
  try {
    const c = wx.getStorageSync(KEY)
    if (c && c.openid && c.isAdmin === true) return c
  } catch (e) { /* storage 异常按无缓存处理 */ }
  return null
}

/**
 * 真正去云端校验一次，并根据结果决定写什么缓存
 * @returns {{openid:string, isAdmin:boolean, ok:boolean}}
 *          ok === false 表示"没校验成功"，不等于"不是管理员"
 */
async function refresh() {
  const app = getApp_()
  const g = app ? app.globalData : null
  const now = Date.now()

  // openid 不变，能复用就复用（内存 → 持久缓存），失败才去调 login
  let openid = (g && g.openid) || ''
  if (!openid) {
    const granted = readGranted()
    if (granted) openid = granted.openid
  }

  if (!openid) {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      openid = (res && res.result && res.result.openid) || ''
    } catch (e) {
      openid = ''
    }
    if (!openid) {
      // 拿不到 openid：连身份都不确定，不留下任何结论
      if (g) { g.openid = ''; g.isAdmin = false; g.adminChecked = false }
      return { openid: '', isAdmin: false, ok: false }
    }
  }

  let isAdmin = false
  try {
    const check = await wx.cloud.callFunction({ name: 'adminApi', data: { action: 'check' } })
    isAdmin = !!(check && check.result && check.result.isAdmin)
  } catch (e) {
    // 校验失败 ≠ 不是管理员：不写缓存，下次调用会重新校验
    if (g) { g.openid = openid; g.isAdmin = false; g.adminChecked = false }
    return { openid, isAdmin: false, ok: false }
  }

  if (g) {
    g.openid = openid
    g.isAdmin = isAdmin
    g.adminChecked = true
    g.adminAt = now
  }

  if (isAdmin) {
    try { wx.setStorageSync(KEY, { openid, isAdmin: true, checkTime: now }) } catch (e) {}
  } else {
    // 否定结论不落盘：保证每次冷启动都会重新问一次云端
    try { wx.removeStorageSync(KEY) } catch (e) {}
  }

  return { openid, isAdmin, ok: true }
}

/**
 * 保证 openid / isAdmin 已就绪
 * @param {boolean} force 强制重新校验（刚被加入白名单、或想立刻生效时用）
 * @returns {{openid:string, isAdmin:boolean, ok:boolean}}
 */
async function ensureIdentity(force) {
  const app = getApp_()
  const g = app ? app.globalData : null
  const now = Date.now()

  if (!force) {
    // 1) 本会话已确认是管理员 → 直接复用
    if (g && g.adminChecked && g.isAdmin && g.openid) {
      return { openid: g.openid, isAdmin: true, ok: true }
    }
    // 2) 内存里的「否定」结论只保留 DENY_TTL，过期即重新校验
    if (g && g.adminChecked && !g.isAdmin && g.adminAt && (now - g.adminAt) < DENY_TTL) {
      return { openid: g.openid || '', isAdmin: false, ok: true }
    }
    // 3) 跨冷启动的持久「肯定」结论
    const granted = readGranted()
    if (granted) {
      if (g) {
        g.openid = granted.openid
        g.isAdmin = true
        g.adminChecked = true
        g.adminAt = now
      }
      return { openid: granted.openid, isAdmin: true, ok: true }
    }
  }

  return refresh()
}

/** 只关心是否管理员 */
async function isAdmin(force) {
  const r = await ensureIdentity(force)
  return !!r.isAdmin
}

/**
 * 强制重新校验并覆盖缓存
 * 后台做了会改变权限的操作（如把某人加入 / 移出 admins）之后调用，
 * 让权限变更立刻生效，而不是等缓存自己过期。
 */
async function refreshIdentity() {
  return ensureIdentity(true)
}

/** 清掉身份缓存（切换账号调试用） */
function clearIdentity() {
  try { wx.removeStorageSync(KEY) } catch (e) {}
  const app = getApp_()
  if (app) {
    app.globalData.openid = null
    app.globalData.isAdmin = false
    app.globalData.adminChecked = false
    app.globalData.adminAt = 0
  }
}

module.exports = { ensureIdentity, isAdmin, refreshIdentity, clearIdentity }
