# 产品展示小程序（可配置管理后台）📦
> A ready-to-use **WeChat Mini Program template** for product showcase & management, built with native WXML/WXSS/JS and **WeChat CloudBase** (cloud functions + database). Includes an admin panel — clone, configure your env ID, and deploy in 15 minutes.
一个开箱即用的**微信小程序产品展示源码**：分类浏览、关键词搜索、详情页、图片上传，配套**可视化管理的后台**——管理员可在后台随时修改条目、图片和全部展示信息，无需改代码、无需重新发布。基于微信云开发（CloudBase），无需自建服务器。

> 本项目已实际落地为「MA 玻璃瓶大全」（酒类包装企业的产品展示小程序），开箱即可迁移部署为任意产品展示场景。

## ✨ 功能特性

**用户端**
- 首页产品轮播与分类展示
- 产品详情页（图文展示）
- 分类浏览与关键词搜索
- 企业信息展示页

**管理端**
- 管理员登录（云函数鉴权）
- 产品管理：新增 / 编辑 / 上下架
- 分类管理
- 站点信息配置

## 🛠 技术栈

- 原生微信小程序（WXML / WXSS / JS）
- 微信云开发：云函数 + 云数据库
- 自建 `ma-dialog` 自定义组件

## 📁 项目结构

```
miniprogram/        小程序前端
├── pages/          页面（首页/分类/详情/搜索/管理端等）
├── components/     自定义组件
├── images/         静态资源
├── utils/          工具函数（api/product/upload 等）
└── app.js          入口
cloudfunctions/     云函数
├── login/          登录鉴权
└── adminApi/       管理端接口
```

## 🚀 运行方式

1. 微信开发者工具导入本项目
2. 填入自己的 AppID，开通云开发环境
3. 部署 `cloudfunctions` 下的两个云函数
4. 编译运行
## 🛠 部署指南（迁移者必看）

### 1. 准备
- 在 mp.weixin.qq.com 注册微信小程序，获取自己的 AppID
- 微信开发者工具导入本项目，把 `project.config.json` 中的 `touristappid` 替换成你的 AppID

### 2. 开通云开发
- 开发者工具点击「云开发」按钮，按引导开通环境，记下环境 ID（形如 `xxx-xxxxxxxx`）
- 进入 `miniprogram/utils/` 目录，把 `env.example.js` **复制一份**改名为 `env.js`
- 打开 `env.js`，把 `'your-env-id'` 替换为你自己的环境 ID

### 3. 初始化数据库（重要）
在云开发控制台 → 数据库，新建 4 个集合，并设置权限：

| 集合 | 用途 | 权限设置 |
|---|---|---|
| admins | 管理员白名单 | 所有用户不可读写 |
| products | 产品数据 | 所有用户可读，仅管理端可写 |
| categories | 分类数据 | 所有用户可读，仅管理端可写 |
| settings | 站点配置 | 所有用户不可读写 |

&gt; 权限设错会导致数据泄露或管理端写不进去。

### 4. 部署云函数
分别右键 `cloudfunctions/login` 和 `cloudfunctions/adminApi` → 「上传并部署：云端安装依赖」。

### 5. 把自己设为管理员
1. 编译运行小程序，在调试器 Console 执行：
   ```js
   wx.cloud.callFunction({ name: 'login' }).then(r =&gt; console.log('openid =', r.result.openid))
   ```
2. 复制打印出的 openid
3. 云开发控制台 → 数据库 → `admins` 集合 → 添加记录 → 字段名填 `openid`，值粘贴刚才的 openid
4. 重新编译，进入管理端，即可管理分类和产品

### 6. 开始使用
- **管理端**：先建分类，再添加产品（支持图片上传）
- **用户端**：首页自动展示已上架的产品与分类

## 🔐 安全说明
- 管理权限由云函数服务端校验（`admins` 白名单），客户端无法伪造
- `admins`、`settings` 集合请保持"所有用户不可读写"，仅云函数可访问
## 📌 说明

- 本项目为个人学习/作品集项目
- 后端基于微信云开发，无需自建服务器