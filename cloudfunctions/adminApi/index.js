const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/** 去掉客户端不该写入的字段 */
function clean(data) {
  const d = Object.assign({}, data || {})
  delete d._id
  delete d._openid
  delete d._cacheTime
  return d
}

/** 管理员白名单校验：admins 集合中是否存在该 openid */
async function checkAdmin(openid) {
  if (!openid) return false
  const res = await db.collection('admins').where({ openid }).limit(1).get()
  return res.data.length > 0
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action, id, data, name } = event || {}

  let isAdmin = false
  try {
    isAdmin = await checkAdmin(OPENID)
  } catch (e) {
    isAdmin = false
  }

  // 身份自检不要求管理员权限
  if (action === 'check') return { isAdmin }
  if (!isAdmin) return { ok: false, msg: '无权限' }

  try {
    switch (action) {
      /* ---------------- 产品 ---------------- */
      case 'addProduct':
        await db.collection('products').add({ data: clean(data) })
        return { ok: true }

      case 'updateProduct':
        await db.collection('products').doc(id).update({ data: clean(data) })
        return { ok: true }

      case 'deleteProduct':
        await db.collection('products').doc(id).remove()
        return { ok: true }

      /* ---------------- 分类 ---------------- */
      case 'addCategory':
        await db.collection('categories').add({ data: clean(data) })
        return { ok: true }

      case 'updateCategory':
        await db.collection('categories').doc(id).update({ data: clean(data) })
        return { ok: true }

      case 'deleteCategory':
        await db.collection('categories').doc(id).remove()
        return { ok: true }

      // 改名：同步更新该分类下所有产品的 category 字段，避免产品从分类里消失
      case 'renameCategory': {
        const newName = String(name || '').trim()
        if (!newName) return { ok: false, msg: '分类名不能为空' }
        let oldName = ''
        try {
          const cur = await db.collection('categories').doc(id).get()
          oldName = (cur.data && cur.data.name) || ''
        } catch (e) { oldName = '' }

        await db.collection('categories').doc(id).update({ data: { name: newName } })

        if (oldName && oldName !== newName) {
          const pro = await db.collection('products').where({ category: oldName }).limit(1000).get()
          await Promise.all(pro.data.map(p =>
            db.collection('products').doc(p._id).update({ data: { category: newName } })
          ))
        }
        return { ok: true, updated: oldName !== newName }
      }

      // 批量保存分类排序：[{ id, sort }]
      case 'saveCategoryOrder': {
        const list = Array.isArray(data) ? data : []
        await Promise.all(list
          .filter(it => it && it.id)
          .map(it => db.collection('categories').doc(it.id).update({
            data: { sort: Number(it.sort) || 0 }
          }))
        )
        return { ok: true }
      }

      /* ---------------- 站点设置 ---------------- */
      // 文档存在时用 update 合并写入（保留未受表单管理的旧字段）；
      // 不存在时用 set 创建。注意：update 对不存在的文档不会抛错而是返回
      // stats.updated === 0，所以必须先用 get 探测，否则 set 永远不会执行。
      case 'saveSettings': {
        const payload = clean(data)
        payload.updatedAt = db.serverDate()
        const doc = db.collection('settings').doc('site')

        let exists = false
        try {
          const cur = await doc.get()
          exists = !!(cur && cur.data)
        } catch (e) {
          exists = false // 文档不存在（-502004）或读取失败 → 走创建分支
        }

        if (exists) {
          await doc.update({ data: payload })
        } else {
          await doc.set({ data: payload })
        }
        return { ok: true, created: !exists }
      }

      default:
        return { ok: false, msg: '未知操作：' + action }
    }
  } catch (e) {
    return { ok: false, msg: (e && e.message) || '服务端错误' }
  }
}
