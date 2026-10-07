/**
 * 图片选择 / 上传 / 清理（v3）
 * 统一走云存储，返回 fileID 数组
 */

function extOf(path) {
  const clean = String(path || '').split('?')[0]
  const i = clean.lastIndexOf('.')
  if (i < 0) return 'jpg'
  const ext = clean.slice(i + 1).toLowerCase()
  return ext.length > 5 ? 'jpg' : ext
}

function rand() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

/**
 * 选图并上传
 * @param {string} dir 云存储目录，如 products / categories / banners / site
 * @param {number} count 最多可选张数
 * @param {boolean} loading 是否显示 loading
 * @returns {Promise<string[]>} fileID 数组
 */
async function pickAndUpload(dir, count, loading) {
  const res = await wx.chooseMedia({
    count: count || 1,
    mediaType: ['image'],
    sizeType: ['compressed'],
    sourceType: ['album', 'camera']
  })
  const files = res.tempFiles || []
  if (!files.length) return []

  if (loading !== false) wx.showLoading({ title: '上传中', mask: true })
  try {
    const out = []
    for (const f of files) {
      const cloudPath = dir + '/' + rand() + '.' + extOf(f.tempFilePath)
      const up = await wx.cloud.uploadFile({ cloudPath, filePath: f.tempFilePath })
      if (up && up.fileID) out.push(up.fileID)
    }
    return out
  } finally {
    if (loading !== false) wx.hideLoading()
  }
}

/** 上传单张（取消选择时返回空字符串） */
async function pickOne(dir) {
  const list = await pickAndUpload(dir, 1)
  return list[0] || ''
}

/**
 * 清理不再引用的云存储文件（非致命，失败静默）
 * 仅删除 cloud:// 开头的 fileID
 */
async function removeFiles(fileIDs) {
  const list = (Array.isArray(fileIDs) ? fileIDs : [fileIDs])
    .filter(f => typeof f === 'string' && f.indexOf('cloud://') === 0)
  if (!list.length) return
  try {
    await wx.cloud.deleteFile({ fileList: list })
  } catch (e) { /* 忽略：可能不是当前账号上传的文件 */ }
}

module.exports = { pickAndUpload, pickOne, removeFiles }
