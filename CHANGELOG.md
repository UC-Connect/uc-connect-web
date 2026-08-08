# Changelog

All notable updates to UC Connect are recorded here.

UC Connect 的重要更新都会记录在这里。

## v0.2.0 - 2026-08-08

### Added / 新增
- Added bilingual Chinese / English language switching across the main product flow.
  新增中文 / 英文双语切换，覆盖主要产品流程。
- Added persistent task notifications for applications, status updates, completion confirmations, and ratings.
  新增持久化任务通知，用于申请、状态更新、完成确认和评分提醒。
- Added matched-only contact sharing through profile contact fields.
  新增匹配后才可查看的联系方式机制，支持邮箱、手机号和微信号。
- Added task editing, recruiting close, and application withdrawal flows.
  新增任务编辑、关闭招募和撤回申请流程。
- Added shareable task detail URLs.
  新增可分享的任务详情链接。
- Added star-only ratings for completed matched tasks.
  新增已完成匹配任务的 1-5 星评分。
- Added task report submission.
  新增任务举报提交功能。

### Changed / 调整
- Moved contact editing into the profile edit modal instead of showing a save-contact form on the profile page.
  将联系方式编辑移入“编辑资料”弹窗，不再在个人主页直接显示保存联系方式表单。
- Simplified the homepage hero copy and removed misleading demo-scale wording.
  简化首页首屏文案，并移除容易误导的演示规模描述。
- Improved mobile layouts for task management, application cards, and modals.
  优化移动端任务管理、申请卡片和弹窗布局。

### Fixed / 修复
- Fixed cases where unauthenticated users could access protected task actions.
  修复未登录用户可访问受保护任务操作的问题。
- Fixed incorrect task ownership display in "My Tasks".
  修复“我的任务”中任务身份展示不匹配的问题。
- Fixed publish form logic for mutual-help tasks and online task locations.
  修复免费互助任务报酬、线上任务地点的表单逻辑。
- Fixed the recurring rating-load failure toast by making rating loading fail gracefully.
  修复每次打开页面都弹出“读取评价失败”的问题，改为静默降级。

## v0.1.0 - 2026-08-06

### Added / 新增
- Built the initial UC Connect MVP with task discovery, posting, applying, and basic task management.
  搭建 UC Connect 初版 MVP，支持任务发现、发布、申请和基础任务管理。
- Added Supabase-backed authentication and database schema.
  接入 Supabase 登录和数据库结构。
- Added the first responsive interface for desktop and mobile.
  完成第一版桌面端和移动端响应式界面。
