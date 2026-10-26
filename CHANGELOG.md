# Changelog

All notable updates to UC Connect are recorded here.

UC Connect 的重要更新都会记录在这里。

## Unreleased

### Added / 新增
- Added GitHub Actions CI for pull requests and `main`: lint, typecheck, unit tests, a retrieval eval threshold, and a production build.
  新增 GitHub Actions CI，覆盖 PR 和 `main`：代码检查、类型检查、单元测试、检索评测阈值和生产构建。
- Added ESLint with the Next.js config and `lint` / `typecheck` scripts.
  新增 ESLint（Next.js 配置）以及 `lint`、`typecheck` 脚本。
- Added an LLM provider layer (`lib/llm`) with a shared chat interface, `LLMError`, zod-validated `LLM_*` settings, a mock provider for tests, and the Gemini provider; an ESLint rule keeps vendor SDKs and API URLs inside `lib/llm/providers`.
  新增 LLM provider 层（`lib/llm`）：统一的对话接口、`LLMError` 错误类型、用 zod 校验的 `LLM_*` 配置、测试用 mock provider 和 Gemini provider；ESLint 规则限制厂商 SDK 和 API 地址只能出现在 `lib/llm/providers`。
- Added DeepSeek (`deepseek-flash`, thinking disabled) and OpenAI (`gpt-6-luna`, reasoning effort none) through one OpenAI-compatible provider, with streamed token usage.
  通过统一的 OpenAI 兼容 provider 接入 DeepSeek（`deepseek-flash`，关闭思考模式）和 OpenAI（`gpt-6-luna`，推理强度 none），流式输出时返回 token 用量。
- Added `LLM_FALLBACK_PROVIDER`: when the primary provider fails with a retryable error before streaming any text, the fallback answers instead.
  新增 `LLM_FALLBACK_PROVIDER`：主 provider 在开始输出前出现可重试错误时，改由备用 provider 回答。
- Added per-answer JSON usage logs (provider, model, tokens, latency, estimated cost, cache hit, fallback) and a dated price table.
  新增每次回答的 JSON 用量日志（provider、模型、token、延迟、估算成本、是否命中缓存、是否走了 fallback）以及注明核对日期的价格表。
- Added `npm run eval:providers` to compare providers on the eval questions (accuracy overall and by language, valid citations, p50/p95 latency, tokens, cost, request failures), writing `eval-results/<date>.md` and `.csv`, plus a manually triggered "Provider eval" GitHub Actions workflow.
  新增 `npm run eval:providers`，用评测题对比各 provider（总准确率和中英文准确率、引用有效率、p50/p95 延迟、token、成本、请求失败数），输出 `eval-results/<日期>.md` 和 `.csv`；并新增手动触发的 "Provider eval" GitHub Actions workflow。
- Added the first provider comparison (`eval-results/2026-10-26.md`): DeepSeek, Gemini, gpt-6-luna, and gpt-5.4-nano, plus README sections on architecture, switching models, and adding a provider.
  新增第一份 provider 对比报告（`eval-results/2026-10-26.md`）：DeepSeek、Gemini、gpt-6-luna、gpt-5.4-nano；README 补充架构说明、切换模型和新增 provider 的方法。

- Added abuse and cost guards for the admissions assistant: signed follow-up context, a daily spend budget (`ADMISSIONS_DAILY_BUDGET_CNY`, default ¥5) tracked in Supabase, a kill switch (`ADMISSIONS_AI_ENABLED`), and an estimated prompt-size check before every model call.
  新增 AI 助手防滥用和成本保护：追问上下文需服务端签名、Supabase 记录的每日花费预算（`ADMISSIONS_DAILY_BUDGET_CNY`，默认 ¥5）、总开关（`ADMISSIONS_AI_ENABLED`），以及每次调用模型前的提示词长度估算。
- Questions with no matching sources now get a fixed "UC admissions only" reply without a model call.
  检索不到任何资料的问题直接回复"只回答 UC 申请问题"，不再调用模型。

### Changed / 调整
- Tightened chat input limits: questions up to 500 characters and the last 4 turns of history; when Supabase is unavailable, stricter per-instance limits apply instead of none.
  收紧聊天输入限制：问题最多 500 字，历史最多 4 轮；Supabase 不可用时改用更严格的单实例限流，不再无限制放行。
- Added Chinese and English query terms for general application questions (申请, apply).
  补充一般申请问题的中英文检索词（申请、apply）。
- The default chat model is now DeepSeek `deepseek-flash`, with Gemini recommended as `LLM_FALLBACK_PROVIDER`; suggested-question answers were regenerated with DeepSeek.
  默认对话模型改为 DeepSeek `deepseek-flash`，建议将 Gemini 设为 `LLM_FALLBACK_PROVIDER`；推荐问题的预生成答案已用 DeepSeek 重新生成。
- Out-of-credit errors (DeepSeek 402, OpenAI `insufficient_quota`) are reported as non-retryable quota errors instead of rate limits.
  余额不足错误（DeepSeek 402、OpenAI `insufficient_quota`）改为不可重试的额度错误，不再被当作限流。
- Answer cache keys and pre-generated answers now include the provider and model, so switching models never serves another model's answers. Re-run `supabase/schema.sql` to add the `provider` column.
  回答缓存 key 和预生成答案加入 provider 和模型，切换模型后不会读到其他模型的旧答案。需重新运行 `supabase/schema.sql` 以新增 `provider` 列。
- Eval grading ignores Markdown emphasis, so "**not** automatically" matches "not automatically".
  评测判分忽略 Markdown 强调符号，例如 "**not** automatically" 可以匹配 "not automatically"。
- Each provider now retries once by default (`LLM_MAX_ATTEMPTS=2`) before failing or falling back.
  每个 provider 默认重试 1 次（`LLM_MAX_ATTEMPTS=2`），之后报错或切换到备用 provider。

## v0.3.0 - 2026-10-14

### Added / 新增
- Added the UC admissions guide at `/admissions`: first-year and transfer views, a fall 2027 key-dates timeline with open/next status, core-requirement highlights, and 20 topic pages summarized from official UC sources.
  新增 UC 申请信息中心 `/admissions`：区分高中生与转学生，提供 2027 秋季关键日期时间线（标注进行中 / 下一个节点）、核心要求速览，以及 20 个整理自 UC 官网的专题页。
- Added topic detail pages at `/admissions/[slug]` with source links, review dates, and related topics.
  新增专题详情页 `/admissions/[slug]`，显示官方来源、核对日期和相关专题。
- Added the admissions AI assistant at `/admissions/ask` with streaming answers, inline numbered citations, source cards, applicant-type selection, follow-up questions, and Chinese/English replies.
  新增申请 AI 助手 `/admissions/ask`：流式输出、行内编号引用、来源卡片、申请类型选择、支持追问，并按提问语言用中文或英文回答。
- Added the `/api/admissions/chat` streaming API (Gemini) with keyword retrieval, Chinese-to-English query terms, applicant-type filtering, and per-instance rate limiting.
  新增 `/api/admissions/chat` 流式接口（Gemini），包含关键词检索、中文提问词映射、申请类型过滤和单实例限流。
- Added retrieval and answer evaluation scripts (`npm run eval:retrieval`, `npm run eval:agent`) with 51 test questions, including Chinese questions.
  新增检索与回答评测脚本（`npm run eval:retrieval`、`npm run eval:agent`），共 51 道测试题，含中文问题。
- Added an admissions entry to the homepage and desktop navigation.
  在首页和桌面导航中新增申请信息入口。
- Added pre-generated answers for the suggested admissions questions (`npm run admissions:prebuild`), served instantly without a model call.
  新增推荐问题的预生成回答（`npm run admissions:prebuild`），点击后即时返回，不调用模型。
- Added a Supabase answer cache for standalone admissions questions, keyed by question, applicant type, and knowledge-base version, with a 30-day lifetime.
  新增 Supabase 回答缓存：按问题、申请类型和知识库版本存储，有效期 30 天。
- Added shared rate limits (per hashed IP and a site-wide daily cap) through the `admissions_consume_quota` function; when the daily cap is reached the assistant shows related topic pages.
  新增共享限流（按哈希后的 IP 和全站每日上限），通过 `admissions_consume_quota` 函数实现；达到每日上限时改为展示相关专题。
- Added calculators at `/admissions/tools`: UC GPA (resident capped-weighted, unweighted, and nonresident) with a statewide top-9% estimate, an A-G checker, and an application fee calculator. All calculations run in the browser.
  新增计算工具 `/admissions/tools`：UC GPA 计算器（加州居民封顶加权、不加权、外州学生）及加州前 9% 估算、A-G 课程检查、申请费计算，全部在浏览器中完成。
- Added rule-based chat answers for dates and deadlines, TAG participation by campus, and application fees, answered without a model call.
  AI 助手新增规则问答：截止日期、各校区是否参加 TAG、申请费，直接由代码回答，不调用模型。
- Added unit tests (`npm test`) for the rules, calculators, and rule-based answers, including checks that every rule value still appears in its knowledge-base document.
  新增单元测试（`npm test`），覆盖规则、计算器和规则问答，并校验每个规则数值仍与知识库原文一致。
- Added UC's full statewide admissions index chart to the knowledge base.
  知识库补充 UC 加州前 9% 完整对照表。

### Changed / 调整
- Retrieval now weights rare terms higher (IDF), sends 4 sources instead of 5 to the model, and caps answers at 800 output tokens to save free-tier quota.
  检索改为对少见词加权（IDF），发送给模型的资料从 5 段减为 4 段，回答上限 800 token，以节省免费额度。
- Added more Chinese query terms (最低, 多少分).
  补充中文检索词（最低、多少分）。

## v0.2.1 - 2026-08-08

### Added / 新增
- Added profile completeness reminders when contact info is missing.
  新增资料完整度提醒，在用户未填写联系方式时提示完善资料。
- Added independent task detail URLs at `/tasks/[id]`.
  新增独立任务详情链接 `/tasks/[id]`。
- Added a task progress timeline on the task detail page.
  在任务详情页新增任务进度时间线。

### Changed / 调整
- Refined the front-end visual style by reducing hero typography, simplifying hero copy, tightening rounded corners, and replacing heavy gradients/shadows with a calmer product UI.
  优化前端视觉风格：缩小首屏标题、精简首屏文案、收紧圆角，并将厚重渐变和阴影改为更克制的产品界面。
- Updated README documentation to reflect the current Supabase-backed MVP, deployment setup, school email rules, and remaining limitations.
  更新 README 文档，使其同步当前 Supabase MVP、部署配置、学校邮箱规则和剩余限制。
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
- Corrected UCLA school-email detection to use `@g.ucla.edu` while keeping UCB as `@berkeley.edu` and UCSD as `@ucsd.edu`.
  修正 UCLA 学校邮箱识别规则为 `@g.ucla.edu`，同时保持 UCB 使用 `@berkeley.edu`、UCSD 使用 `@ucsd.edu`。
- Removed the misleading fallback that showed unknown email domains as UCB; unrecognized emails now display as unverified school accounts.
  移除未知邮箱默认显示为 UCB 的误导逻辑，非三种认证邮箱现在显示为暂未认证学校。
- Removed legacy demo-task fallback data from the discover homepage so only real Supabase tasks are shown.
  移除发现页旧的演示任务兜底数据，现在只展示 Supabase 中的真实任务。
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
