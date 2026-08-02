# UC Connect Demo

UC Connect 是面向 UC 系学生的校园需求与互助平台原型。当前版本使用模拟数据，不包含数据库、真实账号或支付功能。

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

然后打开终端显示的本地地址（通常是 `http://localhost:3000`）。

## 生产构建

```bash
npm run build
npm run start
```

## 主要文件

- `app/page.tsx`：页面内容、模拟任务数据和全部交互逻辑
- `app/globals.css`：页面样式和手机端适配
- `app/layout.tsx`：网页标题与基础布局
- `public/favicon.svg`：网站图标

## 部署

这是标准 Next.js 项目，可以导入 GitHub 后部署到 Vercel，也可以部署到其他支持 Next.js 的平台。

## 当前限制

- 所有任务和用户信息均为模拟数据
- 刷新页面后不会保存发布或申请操作
- 登录按钮仅展示界面，不会建立真实账户
- 未接入 Supabase、支付或邮件服务
