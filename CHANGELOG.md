# Changelog

All notable updates to UC Connect are recorded here.

UC Connect 的重要更新都会记录在这里。

## v0.2.1 - 2026-08-08

### Added / 新增
- Added profile completeness reminders when contact info is missing.
  新增资料完整度提醒，在用户未填写联系方式时提示完善资料。
- Added independent task detail URLs at `/tasks/[id]`.
  新增独立任务详情链接 `/tasks/[id]`。
- Added a task progress timeline on the task detail page.
  在任务详情页新增任务进度时间线。

### Changed / 调整
- Kept legacy `?task=` links compatible while moving new task links to `/tasks/[id]`.
  在新链接改为 `/tasks/[id]` 的同时，继续兼容旧的 `?task=` 链接。

### Fixed / 修复
- Fixed the application-taking flow so accepted applicants can still load matched task details after the task leaves the public open list.
  修复接任务流程中，申请人被接受后任务不再公开招募、导致详情和后续操作可能读取不到的问题。
- Fixed weak accepted-application feedback by tracking application status update time and making accepted applications show a clear contact prompt.
  修复申请被接受后提示不明显的问题，新增申请状态更新时间，并在“我申请的”中明确提示可联系对方。
- Improved matched-contact loading so contact buttons show a loading state and fail with a friendly message instead of appearing unresponsive.
  优化匹配后联系方式读取，联系按钮会显示读取状态，失败时给出友好提示，不再像点击无反应。
- Fixed profile contact persistence by saving profile edits through a dedicated Supabase RPC instead of a broad profile upsert.
  修复联系方式下次登录丢失的问题，资料编辑改为通过专门的 Supabase RPC 保存，不再使用宽泛的 profile upsert。
- Added post-save profile verification so the UI only reports success after Supabase returns the saved contact fields.
  新增资料保存后的数据库回读校验，只有 Supabase 返回已保存的联系方式后才提示保存成功。
- Hardened profile saving with an upsert-based Supabase RPC to handle existing and missing profile rows consistently.
  将资料保存 RPC 改为基于 upsert 的写入方式，统一处理已有资料行和缺失资料行。
- Fixed an ambiguous `id` reference in the profile-save RPC by targeting the `profiles_pkey` constraint explicitly.
  修复资料保存 RPC 中 `id` 字段引用不明确的问题，改为显式使用 `profiles_pkey` 约束处理冲突。
- Clarified the profile-save verification message so database readback mismatches point to the `profiles` table for diagnosis.
  优化资料保存校验失败提示，将问题定位到 `profiles` 表回读不一致，方便继续排查。
- Improved login / sign-up error handling so existing accounts no longer show a raw `user already exists` error.
  优化登录 / 注册错误处理，已存在账号不再直接显示原始的 `user already exists` 错误。
- Separated login and sign-up paths and fixed invalid profile school metadata during registration.
  拆分登录和注册路径，并修复注册时写入非法学校字段导致资料创建失败的问题。

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
