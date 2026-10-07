/**
 * ma-dialog：暗金风格自定义弹窗
 * 替代 wx.showModal（原生弹窗无法定制成黑金主题）
 * mode = 'confirm' 仅确认 | 'input' 带文本输入
 */
Component({
  options: { addGlobalClass: true },

  properties: {
    show: { type: Boolean, value: false },
    mode: { type: String, value: 'confirm' },
    title: { type: String, value: '' },
    content: { type: String, value: '' },
    placeholder: { type: String, value: '' },
    initial: { type: String, value: '' },
    confirmText: { type: String, value: '确定' },
    cancelText: { type: String, value: '取消' },
    danger: { type: Boolean, value: false }
  },

  data: {
    value: '',
    focus: false
  },

  observers: {
    show(v) {
      if (v) {
        this.setData({
          value: this.data.initial || '',
          focus: this.data.mode === 'input'
        })
      } else {
        this.setData({ focus: false })
      }
    }
  },

  methods: {
    noop() {},

    onInput(e) { this.setData({ value: e.detail.value }) },

    onCancel() { this.triggerEvent('cancel') },

    onConfirm() {
      this.triggerEvent('confirm', { value: (this.data.value || '').trim() })
    }
  }
})
