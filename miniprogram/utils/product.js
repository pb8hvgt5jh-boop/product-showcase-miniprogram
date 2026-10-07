/**
 * 产品数据预处理（v3）
 * WXML 不支持箭头函数/复杂表达式，列表项需要在 JS 里预算好展示字段。
 */

function str(v) {
  return (v === null || v === undefined) ? '' : String(v)
}

function toArray(v) {
  return Array.isArray(v) ? v.filter(Boolean) : []
}

/* ============================================================
   老数据兼容：status 字段
   老库里可能存在「没有 status 字段」的文档（上架概念是后加的）。
   微信云数据库 where({ status: 1 }) 只匹配「字段存在且为 1」的文档，
   老文档会被直接过滤掉 —— 前台表现就是整个目录空白。
   因此统一约定：status 缺失 / 为 null 一律视为「上架 · 显示」。
   下面两个函数必须在 DB 侧和 JS 侧成对使用，保证行为一致。
   ============================================================ */

/** JS 侧：文档是否上架（status 缺失视为上架） */
function statusIsOn(raw) {
  const v = (raw || {}).status
  return v === undefined || v === null || Number(v) === 1
}

/**
 * DB 侧：生成「可见」where 条件
 * @param {object} cmd db.command（页面里传 db.command）
 * @returns {{status: any}} 可直接放进 where，也可与其它字段并列组成 AND
 */
function visibleWhere(cmd) {
  return { status: cmd.or(cmd.eq(1), cmd.exists(false)) }
}

/**
 * 把一条 products 文档加工成列表/详情可直接渲染的对象
 * 兼容老数据：price 可能是字符串、images/tags 可能不存在、status 可能缺失
 */
function decorateProduct(p) {
  const raw = p || {}
  const images = toArray(raw.images)
  const tags = toArray(raw.tags).map(t => str(t).trim()).filter(Boolean)
  const sales = Number(raw.sales) || 0

  const priceNum = Number(raw.price)
  const priceValid = raw.price !== '' && raw.price !== null && raw.price !== undefined && !isNaN(priceNum)

  return Object.assign({}, raw, {
    _images: images,
    _cover: images[0] || '',
    _hasImage: images.length > 0,
    _tags: tags,
    _hasTags: tags.length > 0,
    _priceText: priceValid ? '¥' + (Math.round(priceNum * 100) / 100) : '面议',
    _salesText: sales > 0 ? '月售 ' + sales : '新品',
    _catText: str(raw.category).trim() || '未分类',
    _statusOn: statusIsOn(raw)
  })
}

function decorateProducts(list) {
  return (Array.isArray(list) ? list : []).map(decorateProduct)
}

/** 分类文档 → 首页大卡片可直接渲染 */
function decorateCategory(c) {
  const raw = c || {}
  return Object.assign({}, raw, {
    _name: str(raw.name).trim() || '未命名',
    _cover: str(raw.image),
    _hasCover: !!str(raw.image),
    _sort: Number(raw.sort) || 0,
    _visible: statusIsOn(raw)
  })
}

module.exports = {
  decorateProduct,
  decorateProducts,
  decorateCategory,
  toArray,
  str,
  statusIsOn,
  visibleWhere
}
