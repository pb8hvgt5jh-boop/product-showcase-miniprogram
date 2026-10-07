/**
 * adminApi 云函数调用封装（v3）
 * 所有写操作必须走这里 —— 客户端数据库无写权限。
 */

const NAME = 'adminApi'

/** 文档不存在的错误码（各端文案不一致，故同时判码与判文案） */
const NOT_FOUND_CODE = -502004

/**
 * 区分「文档确实不存在」和「读取失败」
 * 前者是正常空态，后者必须提示用户，不能混为一谈
 */
function isNotFound(e) {
  if (!e) return false
  if (e.errCode === NOT_FOUND_CODE) return true
  const msg = String(e.errMsg || e.message || '')
  return /not exist|cannot find|does not exist|-502004/i.test(msg)
}

async function call(action, payload) {
  const data = Object.assign({ action }, payload || {})
  let res
  try {
    res = await wx.cloud.callFunction({ name: NAME, data })
  } catch (e) {
    // 网络 / 云函数调用本身失败：抛可读文案，不把技术堆栈甩给用户
    throw new Error('网络异常，请重试')
  }
  const r = (res && res.result) || {}
  // 所有写操作必须拿到明确的 ok:true 才算成功。
  // 返回体异常（例如云函数崩溃后 result 为空）一律按失败处理，
  // 否则会出现"界面提示保存成功、实际什么都没写"的静默失败。
  if (r.ok !== true) throw new Error(r.msg || '操作失败，请重试')
  return r
}

/** 身份自检：后端不返回 ok 字段，单独走一条宽松通道 */
async function check() {
  try {
    const res = await wx.cloud.callFunction({ name: NAME, data: { action: 'check' } })
    const r = (res && res.result) || {}
    return { isAdmin: !!r.isAdmin, ok: true }
  } catch (e) {
    return { isAdmin: false, ok: false }
  }
}

module.exports = {
  call,
  check,
  isNotFound,
  addProduct: (data) => call('addProduct', { data }),
  updateProduct: (id, data) => call('updateProduct', { id, data }),
  deleteProduct: (id) => call('deleteProduct', { id }),
  addCategory: (data) => call('addCategory', { data }),
  updateCategory: (id, data) => call('updateCategory', { id, data }),
  renameCategory: (id, name) => call('renameCategory', { id, name }),
  deleteCategory: (id) => call('deleteCategory', { id }),
  saveCategoryOrder: (data) => call('saveCategoryOrder', { data }),
  saveSettings: (data) => call('saveSettings', { data })
}
