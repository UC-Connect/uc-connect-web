"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { User } from "@supabase/supabase-js";
import { ApplicationRow, ReviewRow, supabase, TaskRow } from "@/lib/supabase";

type Lang = "zh" | "en";

type Task = {
  id: string;
  authorId?: string;
  title: string;
  school: "UCB" | "UCSD" | "UCLA";
  category: string;
  mode: string;
  reward: string;
  time: string;
  createdAt: string;
  applicants: number;
  author: string;
  verified: boolean;
  avatar: string;
  description: string;
  location: string;
  due: string;
  tone: string;
  status: TaskRow["status"];
  authorCompletedAt: string | null;
  applicantCompletedAt: string | null;
};

const demoTasks: Task[] = [
  {
    id: "demo-1",
    title: "帮忙实拍 Blackwell Hall 宿舍公共区域",
    school: "UCB",
    category: "校园实拍",
    mode: "线下",
    reward: "$25",
    time: "12 分钟前",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    applicants: 3,
    author: "Mia Chen",
    verified: true,
    avatar: "MC",
    description: "我是今年 Fall 入学的新生，想提前看看 Blackwell Hall 的公共厨房、洗衣房和一楼学习区。希望可以拍 8–10 张清晰照片，再简单说一下晚上是否吵。",
    location: "UC Berkeley · Blackwell Hall",
    due: "8 月 8 日前",
    tone: "blue",
    status: "open",
    authorCompletedAt: null,
    applicantCompletedAt: null,
  },
  {
    id: "demo-2",
    title: "想咨询 Math-CS 转 Data Science 的选课规划",
    school: "UCSD",
    category: "经验咨询",
    mode: "线上",
    reward: "$18",
    time: "28 分钟前",
    createdAt: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    applicants: 5,
    author: "Eason L.",
    verified: false,
    avatar: "EL",
    description: "目前是二年级 Math-CS，正在考虑转 Data Science。想找一位了解两个专业课程设置的学长学姐聊 30 分钟，主要讨论先修课、毕业时间和实习准备。",
    location: "线上 · Zoom / 微信语音",
    due: "本周内",
    tone: "teal",
    status: "open",
    authorCompletedAt: null,
    applicantCompletedAt: null,
  },
  {
    id: "demo-3",
    title: "新生到校，求一起熟悉 Westwood 周边",
    school: "UCLA",
    category: "新生落地",
    mode: "线下",
    reward: "免费互助",
    time: "1 小时前",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    applicants: 2,
    author: "Sophie Wu",
    verified: true,
    avatar: "SW",
    description: "刚到 UCLA，想找同学一起走一遍超市、公交站和常用餐厅。我也可以请你喝奶茶，希望大概一小时左右。",
    location: "UCLA · Westwood",
    due: "8 月 10 日",
    tone: "gold",
    status: "open",
    authorCompletedAt: null,
    applicantCompletedAt: null,
  },
  {
    id: "demo-4",
    title: "借一个 TI-84 计算器参加周五考试",
    school: "UCB",
    category: "校园互助",
    mode: "线下",
    reward: "$10",
    time: "2 小时前",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    applicants: 1,
    author: "Jason Y.",
    verified: true,
    avatar: "JY",
    description: "计算器突然坏了，需要借用周五一天。可以在 Sather Gate 附近取还，会好好保管。",
    location: "UC Berkeley · Sather Gate",
    due: "本周五",
    tone: "violet",
    status: "open",
    authorCompletedAt: null,
    applicantCompletedAt: null,
  },
  {
    id: "demo-5",
    title: "请分享一次 UCLA 校内研究申请经验",
    school: "UCLA",
    category: "经验咨询",
    mode: "线上",
    reward: "$20",
    time: "今天 09:40",
    createdAt: new Date().toISOString(),
    applicants: 4,
    author: "Lina Zhang",
    verified: false,
    avatar: "LZ",
    description: "准备秋季申请校内 research，希望找成功加入 lab 的同学聊聊 cold email、简历和面试经验。",
    location: "线上",
    due: "下周前",
    tone: "coral",
    status: "open",
    authorCompletedAt: null,
    applicantCompletedAt: null,
  },
  {
    id: "demo-6",
    title: "求帮忙确认 Sixth College 附近自行车停车位",
    school: "UCSD",
    category: "校园信息",
    mode: "线下",
    reward: "$12",
    time: "今天 08:15",
    createdAt: new Date().toISOString(),
    applicants: 0,
    author: "Kevin H.",
    verified: true,
    avatar: "KH",
    description: "准备买自行车，想知道 Catalyst 附近晚上可用的停车架多不多，最好能拍两张照片。",
    location: "UCSD · Sixth College",
    due: "三天内",
    tone: "teal",
    status: "open",
    authorCompletedAt: null,
    applicantCompletedAt: null,
  },
];

const categories = ["全部任务", "校园实拍", "新生落地", "经验咨询", "校园互助", "校园信息"];

const textMap: Record<string, string> = {
  "主导航": "Primary navigation",
  "发现任务": "Discover",
  "我的任务": "My Tasks",
  "我的": "Me",
  "消息": "Messages",
  "请先登录后查看我的任务": "Please log in to view your tasks",
  "请先登录后查看消息": "Please log in to view messages",
  "请先登录后再发布需求": "Please log in before posting a request",
  "请先登录后继续": "Please log in to continue",
  "已登录": "Logged in",
  "登录": "Log In",
  "发布需求": "Post Request",
  "打开个人主页": "Open profile",
  "查看资料": "View Profile",
  "公开资料": "Public Profile",
  "完成次数": "Completed",
  "平均评分": "Average Rating",
  "联系方式仅在任务匹配后展示。": "Contact info is shown only after a task match.",
  "让每一个需求，": "Let every request",
  "找到对的人回应。": "reach the right person.",
  "连接 UC 校园里的同学，发布需求、分享经验、互相帮忙。简单一点，真诚一点。": "Connect with students across UC campuses to post requests, share experience, and help each other.",
  "浏览附近任务": "Browse Tasks",
  "我有一个需求": "Post a Request",
  "最新任务": "Latest Tasks",
  "数据库同步": "Database Sync",
  "人申请": "applicants",
  "发现正在发生的需求": "Discover Active Requests",
  "全部 UC": "All UC",
  "全部任务": "All Tasks",
  "校园实拍": "Campus Photos",
  "新生落地": "New Student Help",
  "经验咨询": "Experience Advice",
  "校园互助": "Campus Help",
  "校园信息": "Campus Info",
  "搜索任务": "Search tasks",
  "正在读取任务": "Loading tasks",
  "连接 Supabase 数据库中。": "Connecting to the Supabase database.",
  "学校邮箱已认证": "School email verified",
  "人已申请": "applied",
  "查看详情": "View Details",
  "暂时没有匹配的任务": "No matching tasks yet",
  "换个学校或关键词试试。": "Try another school or keyword.",
  "三步，找到你的校园连接": "Three Steps to a Campus Connection",
  "发布一个需求": "Post a Request",
  "说清楚你需要什么、时间和地点。": "Describe what you need, when, and where.",
  "选择合适的同学": "Choose the Right Student",
  "查看申请说明和学校认证信息。": "Review application notes and school verification.",
  "完成并互相评价": "Complete and Rate",
  "确认完成，给认真帮助的人一点认可。": "Confirm completion and recognize helpful work.",
  "返回任务列表": "Back to Tasks",
  "完成任务后可互相评分": "Rate each other after completion",
  "已认证": "Verified",
  "地点": "Location",
  "希望完成": "Due",
  "任务形式": "Mode",
  "需求说明": "Request Details",
  "申请时可以简单介绍你的时间安排。如果有相关经验，也请一起说明。": "When applying, briefly share your availability and any relevant experience.",
  "安全提醒": "Safety Note",
  "请勿提前转账或分享敏感个人信息。接受申请后再交换联系方式。": "Do not pay in advance or share sensitive personal information. Exchange contact info only after a match.",
  "任务报酬": "Reward",
  "平台暂不处理真实付款": "Payments are not processed on platform yet",
  "已有申请": "Applications",
  "管理任务": "Manage Task",
  "查看申请": "View Applications",
  "申请接取": "Apply",
  "申请说明": "Application Note",
  "介绍一下你为什么适合，以及可以完成的时间…": "Share why you are a good fit and when you can complete it...",
  "可完成时间": "Available Time",
  "例如：周三下午": "Example: Wednesday afternoon",
  "提交申请": "Submit Application",
  "取消": "Cancel",
  "申请已提交": "Application Submitted",
  "发布者选择后会通知你。": "You will be notified after the poster makes a decision.",
  "举报此任务": "Report this task",
  "返回发现": "Back to Discover",
  "描述得越清楚，越容易找到合适的同学。": "Clearer descriptions make it easier to find the right student.",
  "基本信息": "Basic Info",
  "先让大家一眼看懂你需要什么。": "Help others understand what you need at a glance.",
  "需求标题": "Request Title",
  "例如：帮忙实拍宿舍公共区域": "Example: Take photos of a dorm common area",
  "任务类别": "Category",
  "请选择": "Select one",
  "所属学校": "School",
  "详细说明": "Description",
  "具体需要做什么？有没有特别需要注意的地方？": "What needs to be done? Anything important to note?",
  "时间与地点": "Time and Location",
  "告诉申请者在哪里、什么时候完成。": "Tell applicants where and when to complete it.",
  "线下": "In Person",
  "线上": "Online",
  "任务范围": "Task Scope",
  "本校学生": "Same-campus students",
  "所有 UC 学生": "All UC students",
  "线上方式": "Online Method",
  "例如：Zoom / 微信语音，可留空": "Example: Zoom / WeChat call, optional",
  "例如：Blackwell Hall": "Example: Blackwell Hall",
  "希望完成时间": "Preferred Completion Date",
  "报酬说明": "Reward Details",
  "平台暂不处理真实付款。": "Payments are not processed on platform yet.",
  "需求类型": "Request Type",
  "有偿任务": "Paid Task",
  "免费互助": "Free Help",
  "报酬金额": "Reward Amount",
  "免费互助无需填写": "No amount needed for free help",
  "我确认该需求不涉及代写、代考、换汇、违法服务或其他平台禁止内容。": "I confirm this request does not involve ghostwriting, proxy exams, currency exchange, illegal services, or prohibited content.",
  "保存草稿": "Save Draft",
  "需求已发布": "Request Posted",
  "你的任务现在会出现在对应校园的任务流中。": "Your task now appears in the matching campus feed.",
  "新的校园需求": "New Campus Request",
  "刚刚": "Just now",
  "等待第一位申请者": "Waiting for the first applicant",
  "前往我的任务": "Go to My Tasks",
  "返回首页": "Back to Home",
  "在这里跟进你发布和申请的所有需求。": "Track everything you posted and applied for here.",
  "我发布的": "Posted",
  "我申请的": "Applied",
  "招募中": "Open",
  "进行中": "In Progress",
  "已完成": "Completed",
  "已取消": "Cancelled",
  "共": "Total",
  "份申请": "applications",
  "等待双方完成": "Waiting for both sides",
  "可查看记录和评价": "View records and ratings",
  "最近发布": "Recent Posts",
  "新需求": "New Request",
  "编辑": "Edit",
  "关闭招募": "Close Recruiting",
  "联系对方": "Contact",
  "确认完成": "Mark Complete",
  "我已完成": "I Finished",
  "等待对方确认": "Waiting for the other side",
  "你已确认完成": "You confirmed completion",
  "双方确认后才会进入已完成并开放评价。": "The task is completed and ratings open only after both sides confirm.",
  "任务已确认，等待对方确认": "Confirmed. Waiting for the other side.",
  "双方已确认，任务已完成": "Both sides confirmed. Task completed.",
  "查看记录": "View Record",
  "评价对方": "Rate",
  "已评价": "Rated",
  "没有对应状态的任务": "No tasks in this status",
  "发布或切换状态筛选后，会显示在这里。": "Post a task or switch filters to see it here.",
  "申请管理": "Application Management",
  "暂无申请": "No applications yet",
  "有同学申请后会出现在这里。": "Applications will appear here once students apply.",
  "信用评价": "Rating",
  "接受": "Accept",
  "拒绝": "Reject",
  "申请记录": "Application Records",
  "状态有变化时会收到提醒": "You will be notified when status changes",
  "申请于": "Applied",
  "评价发布者": "Rate Poster",
  "申请详情页待上线": "Application details page is coming soon",
  "还没有申请记录": "No application records yet",
  "申请任务后，会显示在这里。": "Tasks you apply for will appear here.",
  "任务申请和状态更新会出现在这里。": "Task applications and status updates appear here.",
  "任务通知": "Task Notifications",
  "收到新的任务申请": "New task application",
  "申请状态已处理": "Application status updated",
  "任务等待完成确认": "Task waiting for completion confirmation",
  "任务已完成，可进行评价": "Task completed. Rating is available.",
  "收到新的评分": "New rating received",
  "对方已确认完成，请你确认后进入评价。": "The other side confirmed completion. Confirm yours to open ratings.",
  "你收到了一条新的星级评分。": "You received a new star rating.",
  "申请了": "applied to",
  "你申请的": "Your application for",
  "当前状态": "current status",
  "聊天消息": "Chat Messages",
  "聊天消息下一步接入": "Chat messages can be added next",
  "条未读": "unread",
  "已全部读完": "All read",
  "还没有消息": "No messages yet",
  "编辑资料": "Edit Profile",
  "退出登录": "Log Out",
  "资料摘要": "Profile Summary",
  "联系方式只会在双方匹配后展示给对方，不会出现在公开任务列表。": "Contact info is shown only after a match and never on public task lists.",
  "显示名称": "Display Name",
  "专业": "Major",
  "未填写": "Not filled",
  "联系邮箱": "Contact Email",
  "手机号": "Phone",
  "微信号": "WeChat ID",
  "所在校区": "Campus",
  "发布任务": "Posted Tasks",
  "申请任务": "Applied Tasks",
  "完成任务": "Completed Tasks",
  "收到的评价": "Ratings Received",
  "暂无评分": "No ratings yet",
  "条评分": "ratings",
  "基于": "Based on",
  "还没有评分": "No ratings yet",
  "完成任务后，对方给你的星级会显示在这里。": "After completing a task, ratings from others will show here.",
  "连接每一个 UC 校园，让需求找到回应。": "Connecting every UC campus so requests find responses.",
  "欢迎来到 UC Connect": "Welcome to UC Connect",
  "登录后即可发布需求、提交申请和管理任务。": "Log in to post requests, apply, and manage tasks.",
  "使用 Google 登录": "Continue with Google",
  "或": "or",
  "邮箱地址": "Email Address",
  "密码": "Password",
  "至少 6 位密码": "At least 6 characters",
  "登录 / 注册": "Log In / Sign Up",
  "新邮箱会自动创建账号。使用学校邮箱可获得 UC 认证标志。": "New emails create an account automatically. School emails get UC verification.",
  "这些联系方式只会在双方匹配后展示给对方。": "This contact info is shown only after a match.",
  "例如：Data Science": "Example: Data Science",
  "可选": "Optional",
  "保存资料": "Save Profile",
  "建议至少填写邮箱或微信，方便任务匹配后联系。": "Add at least an email or WeChat so matched users can contact you.",
  "联系": "Contact",
  "UC Connect 暂不提供站内实时聊天，请通过对方公开给匹配对象的联系方式沟通。": "UC Connect does not offer real-time in-app chat yet. Use the contact info shared with matched users.",
  "邮箱": "Email",
  "请勿提前转账或分享敏感个人信息。建议先确认任务范围和交付方式。": "Do not pay in advance or share sensitive personal information. Confirm scope and delivery first.",
  "评价": "Rate",
  "这次先只打星，不写评论。": "For now, just choose stars. No written review.",
  "评分": "Rating",
  "提交": "Submit",
  "星评价": "star rating",
  "等待回复": "Pending",
  "已接受": "Accepted",
  "未通过": "Rejected",
  "已撤回": "Withdrawn",
  "时间待定": "Time TBD",
  "未登录用户": "Guest",
  "未设置学校": "School not set",
  "读取数据库失败，请稍后再试": "Failed to load database. Please try again later.",
  "读取申请记录失败": "Failed to load application records",
  "读取评价失败": "Failed to load ratings",
  "读取收到的申请失败": "Failed to load received applications",
  "读取公开资料失败": "Failed to load public profile",
  "已退出登录": "Logged out",
  "联系方式已保存": "Contact info saved",
  "请先配置 Supabase 环境变量": "Please configure Supabase environment variables first",
  "登录成功": "Logged in",
  "账号已创建，请再点一次登录": "Account created. Please click log in again.",
  "注册并登录成功": "Registered and logged in",
  "该内容可能涉及平台禁止事项，请修改后再发布": "This content may violate platform rules. Please edit before posting.",
  "草稿已保存": "Draft saved",
  "请先登录后再申请任务": "Please log in before applying",
  "不能申请自己发布的任务": "You cannot apply to your own task",
  "你已经申请过这个任务": "You have already applied to this task",
  "任务已完成": "Task completed",
  "任务状态已更新": "Task status updated",
  "对方还没有填写联系方式": "The other user has not added contact info yet",
  "你已经评价过对方": "You have already rated this user",
  "评价已提交": "Rating submitted",
  "还没有已接受的申请人": "No accepted applicant yet",
  "举报功能即将开放": "Report flow is coming soon",
  "Google 登录可以下一步接入": "Google login can be added next",
  "编辑功能待上线": "Edit is coming soon",
  "已关闭的任务不能继续操作": "Closed tasks cannot be edited further",
  "接受这位申请人后，任务会进入进行中，其他待处理申请会自动标记为未通过。确认接受吗？": "Accepting this applicant will move the task to In Progress and reject other pending applications. Continue?",
  "确认关闭这个任务吗？关闭后其他同学将不能继续申请。": "Close this task? Others will no longer be able to apply.",
  "确认任务已经完成吗？完成后可以进入评价流程。": "Confirm this task is complete? You can rate each other afterward.",
  "确认你已经完成这项任务吗？双方都确认后才会开放评价。": "Confirm you have completed this task? Ratings open after both sides confirm.",
  "确认更新任务状态吗？": "Confirm status update?",
  "已接受申请，任务进入进行中": "Application accepted. Task moved to In Progress.",
  "已拒绝申请": "Application rejected",
};

type PublishDraft = {
  title?: string;
  category?: string;
  school?: Task["school"];
  description?: string;
  mode?: "线上" | "线下";
  location?: string;
  due_date?: string;
  reward_type?: "paid" | "mutual_help";
  reward_amount?: string;
};

type AppliedTask = {
  id: string;
  status: ApplicationRow["status"];
  createdAt: string;
  taskId: string;
  task: {
    authorId: string;
    status: TaskRow["status"];
    authorCompletedAt: string | null;
    applicantCompletedAt: string | null;
    title: string;
    school: Task["school"];
    mode: string;
    reward: string;
    createdAt: string;
  };
  author: {
    name: string;
    email: string | null;
    phone: string | null;
    wechat: string | null;
  };
};

type ReceivedApplication = {
  id: string;
  taskId: string;
  taskTitle: string;
  taskStatus: TaskRow["status"];
  applicantId: string;
  applicantName: string;
  applicantAvatar: string;
  applicantSchool: string;
  applicantMajor: string;
  applicantVerified: boolean;
  contactEmail: string | null;
  phone: string | null;
  wechat: string | null;
  message: string;
  availableTime: string;
  status: ApplicationRow["status"];
  createdAt: string;
};

type ContactInfo = {
  name: string;
  email: string | null;
  phone: string | null;
  wechat: string | null;
};

type ProfileContact = {
  display_name: string;
  major: string;
  contact_email: string;
  phone: string;
  wechat_id: string;
};

type ReviewSummary = {
  average: number;
  count: number;
};

type PublicProfile = {
  id: string;
  name: string;
  school: string;
  major: string | null;
  initials: string;
  verified: boolean;
  rating: ReviewSummary;
  completedCount: number;
};

function renderStars(rating: number) {
  return "★★★★★".slice(0, rating) + "☆☆☆☆☆".slice(0, 5 - rating);
}

function readLanguage(): Lang {
  if (typeof window === "undefined") return "zh";
  return window.localStorage.getItem("uc-connect-language") === "en" ? "en" : "zh";
}

function trStatic(lang: Lang, text: string) {
  return lang === "zh" ? text : textMap[text] ?? text;
}

function translateKnownValue(lang: Lang, value: string) {
  if (lang === "zh") return value;
  let translated = textMap[value] ?? value;
  translated = translated.replace(/(\d+) 人申请/g, "$1 applicants");
  translated = translated.replace(/(\d+) 人已申请/g, "$1 applied");
  translated = translated.replace(/(\d+) 份申请/g, "$1 applications");
  translated = translated.replace(/(\d+) 分钟前/g, "$1 min ago");
  translated = translated.replace(/(\d+) 小时前/g, "$1 hr ago");
  translated = translated.replace(/(\d+) 天前/g, "$1 days ago");
  translated = translated.replace(/今天 /g, "Today ");
  translated = translated.replace(/本周内/g, "This week");
  translated = translated.replace(/本周五/g, "This Friday");
  translated = translated.replace(/下周前/g, "Before next week");
  translated = translated.replace(/三天内/g, "Within 3 days");
  translated = translated.replace(/8 月 8 日前/g, "Before Aug 8");
  translated = translated.replace(/8 月 10 日/g, "Aug 10");
  translated = translated.replace(/共 (\d+) 份申请/g, "Total $1 applications");
  translated = translated.replace(/申请于 /g, "Applied ");
  translated = translated.replace(/刚刚 · 等待第一位申请者/g, "Just now · Waiting for the first applicant");
  return translated;
}

function formatReward(task: Pick<TaskRow, "reward_amount" | "reward_type">) {
  if (task.reward_type === "mutual_help") return "免费互助";
  return task.reward_amount === null ? "$0" : `$${Number(task.reward_amount).toFixed(0)}`;
}

function formatRelativeTime(value: string) {
  const created = new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.round((Date.now() - created) / 60000));
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.round(diffHours / 24)} 天前`;
}

function formatDueDate(value: string | null) {
  if (!value) return "时间待定";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatApplicationStatus(status: ApplicationRow["status"]) {
  if (status === "pending") return "等待回复";
  if (status === "accepted") return "已接受";
  if (status === "rejected") return "未通过";
  return "已撤回";
}

function formatTaskStatus(status: TaskRow["status"]) {
  if (status === "open") return "招募中";
  if (status === "in_progress" || status === "matched") return "进行中";
  if (status === "completed") return "已完成";
  return "已取消";
}

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    school: row.school,
    category: row.category,
    mode: row.mode,
    reward: formatReward(row),
    time: formatRelativeTime(row.created_at),
    createdAt: row.created_at,
    applicants: row.applications_count,
    author: row.profiles?.display_name ?? "UC Student",
    verified: row.profiles?.verified_uc_email ?? false,
    avatar: row.profiles?.avatar_initials ?? "UC",
    description: row.description,
    location: row.location,
    due: formatDueDate(row.due_date),
    tone: row.school === "UCB" ? "blue" : row.school === "UCSD" ? "teal" : "gold",
    status: row.status,
    authorCompletedAt: row.author_completed_at ?? null,
    applicantCompletedAt: row.applicant_completed_at ?? null,
  };
}

function mapApplicationRow(row: ApplicationRow): AppliedTask | null {
  if (!row.tasks) return null;

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    taskId: row.task_id,
    task: {
      title: row.tasks.title,
      authorId: row.tasks.author_id,
      status: row.tasks.status,
      authorCompletedAt: row.tasks.author_completed_at ?? null,
      applicantCompletedAt: row.tasks.applicant_completed_at ?? null,
      school: row.tasks.school,
      mode: row.tasks.mode,
      reward: formatReward(row.tasks),
      createdAt: row.tasks.created_at,
    },
    author: {
      name: row.tasks.profiles?.display_name ?? "任务发布者",
      email: row.tasks.profiles?.contact_email ?? null,
      phone: row.tasks.profiles?.phone ?? null,
      wechat: row.tasks.profiles?.wechat_id ?? null,
    },
  };
}

function mapReceivedApplicationRow(row: ApplicationRow): ReceivedApplication | null {
  if (!row.tasks) return null;

  const task = row.tasks as Pick<TaskRow, "id" | "title" | "status">;
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: task.title,
    taskStatus: task.status,
    applicantId: row.applicant_id,
    applicantName: row.profiles?.display_name ?? "UC Student",
    applicantAvatar: row.profiles?.avatar_initials ?? "UC",
    applicantSchool: row.profiles?.school ?? "UC",
    applicantMajor: row.profiles?.major ?? "未填写专业",
    applicantVerified: row.profiles?.verified_uc_email ?? false,
    contactEmail: row.profiles?.contact_email ?? null,
    phone: row.profiles?.phone ?? null,
    wechat: row.profiles?.wechat_id ?? null,
    message: row.message,
    availableTime: row.available_time,
    status: row.status,
    createdAt: row.created_at,
  };
}

function readPublishDraft(): PublishDraft {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem("uc-connect-publish-draft") ?? "{}") as PublishDraft;
  } catch {
    return {};
  }
}

function hasProhibitedContent(text: string) {
  return /(代写|代考|替考|帮我写作业|写作业|代做|换汇|刷课|作弊)/i.test(text);
}

function getUserName(user: User | null) {
  if (!user?.email) return "未登录用户";
  return String(user.user_metadata?.display_name ?? user.email.split("@")[0]);
}

function getUserInitials(user: User | null) {
  if (!user?.email) return "UC";
  return getUserName(user).slice(0, 2).toUpperCase();
}

function getUserSchool(user: User | null) {
  const email = user?.email ?? "";
  if (email.endsWith("@ucsd.edu")) return "UCSD";
  if (email.endsWith("@ucla.edu")) return "UCLA";
  if (email.endsWith("@berkeley.edu")) return "UCB";
  return "未设置学校";
}

export default function Home() {
  const [view, setView] = useState<"home" | "publish" | "mine" | "profile" | "messages">("home");
  const [school, setSchool] = useState("全部 UC");
  const [category, setCategory] = useState("全部任务");
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>(demoTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [applied, setApplied] = useState(false);
  const [notice, setNotice] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [published, setPublished] = useState(false);
  const [mineTab, setMineTab] = useState<"posted" | "applied">("posted");
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [lastPublishedTask, setLastPublishedTask] = useState<Task | null>(null);
  const [appliedTasks, setAppliedTasks] = useState<AppliedTask[]>([]);
  const [receivedApplications, setReceivedApplications] = useState<ReceivedApplication[]>([]);
  const [managedTaskId, setManagedTaskId] = useState<string | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | TaskRow["status"]>("all");
  const [profileContact, setProfileContact] = useState<ProfileContact>({ display_name: "", major: "", contact_email: "", phone: "", wechat_id: "" });
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>({ average: 0, count: 0 });
  const [receivedReviews, setReceivedReviews] = useState<ReviewRow[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewRow[]>([]);
  const [reviewTarget, setReviewTarget] = useState<{ taskId: string; revieweeId: string; name: string } | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [language, setLanguage] = useState<Lang>(() => readLanguage());
  const [messageReadAt, setMessageReadAt] = useState(() => (
    typeof window === "undefined" ? 0 : Number(window.localStorage.getItem("uc-connect-message-read-at") ?? 0)
  ));
  const [publishDraft, setPublishDraft] = useState<PublishDraft>(() => readPublishDraft());
  const [publishMode, setPublishMode] = useState<"线上" | "线下">(publishDraft.mode ?? "线下");
  const [rewardType, setRewardType] = useState<"paid" | "mutual_help">(publishDraft.reward_type ?? "paid");
  const t = (text: string) => trStatic(language, text);
  const tv = (text: string) => translateKnownValue(language, text);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadTasks();

    if (user) {
      loadProfile();
      loadApplications();
      loadReceivedApplications();
      loadReviews();
      return;
    }

    setAppliedTasks([]);
    setReceivedApplications([]);
    setReceivedReviews([]);
    setMyReviews([]);
    setReviewSummary({ average: 0, count: 0 });
    setProfileContact({ display_name: "", major: "", contact_email: "", phone: "", wechat_id: "" });
  }, [user]);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    window.localStorage.setItem("uc-connect-language", language);
  }, [language]);

  const discoverableTasks = useMemo(() => tasks.filter((task) => task.status === "open"), [tasks]);

  const filtered = useMemo(() => discoverableTasks.filter((task) => {
    const schoolMatch = school === "全部 UC" || task.school === school;
    const categoryMatch = category === "全部任务" || task.category === category;
    const normalizedQuery = query.toLowerCase();
    const queryMatch = task.title.toLowerCase().includes(normalizedQuery)
      || task.category.toLowerCase().includes(normalizedQuery)
      || tv(task.category).toLowerCase().includes(normalizedQuery);
    return schoolMatch && categoryMatch && queryMatch;
  }), [discoverableTasks, school, category, query, language]);

  const postedTasks = useMemo(() => {
    if (!user) return [];
    return tasks.filter((task) => task.authorId === user.id);
  }, [tasks, user]);

  const visiblePostedTasks = useMemo(() => (
    taskStatusFilter === "all" ? postedTasks : postedTasks.filter((task) => task.status === taskStatusFilter)
  ), [postedTasks, taskStatusFilter]);

  const featuredTasks = useMemo(() => discoverableTasks.slice(0, 3), [discoverableTasks]);

  const managedTaskApplications = useMemo(() => (
    receivedApplications.filter((application) => application.taskId === managedTaskId)
  ), [receivedApplications, managedTaskId]);

  const acceptedApplicationByTaskId = useMemo(() => {
    const map = new Map<string, ReceivedApplication>();
    receivedApplications.forEach((application) => {
      if (application.status === "accepted") map.set(application.taskId, application);
    });
    return map;
  }, [receivedApplications]);

  const openPostedCount = postedTasks.filter((task) => task.status === "open").length;
  const inProgressPostedCount = postedTasks.filter((task) => task.status === "in_progress" || task.status === "matched").length;
  const completedPostedCount = postedTasks.filter((task) => task.status === "completed").length;
  const taskNotifications = useMemo(() => [
    ...receivedApplications.map((application) => ({
      id: `received-${application.id}`,
      title: application.status === "pending" ? t("收到新的任务申请") : t("申请状态已处理"),
      body: language === "zh"
        ? `${application.applicantName} 申请了「${application.taskTitle}」：${application.message}`
        : `${application.applicantName} ${t("申请了")} "${application.taskTitle}": ${application.message}`,
      time: application.createdAt,
      status: tv(formatApplicationStatus(application.status)),
    })),
    ...appliedTasks.map((application) => ({
      id: `applied-${application.id}`,
      title: application.status === "pending" ? t("申请已提交") : tv(formatApplicationStatus(application.status)),
      body: language === "zh"
        ? `你申请的「${application.task.title}」当前状态：${formatApplicationStatus(application.status)}`
        : `${t("你申请的")} "${application.task.title}" ${t("当前状态")}: ${tv(formatApplicationStatus(application.status))}`,
      time: application.createdAt,
      status: tv(formatApplicationStatus(application.status)),
    })),
    ...postedTasks
      .filter((task) => task.status === "in_progress" && task.applicantCompletedAt && !task.authorCompletedAt)
      .map((task) => ({
        id: `posted-confirm-${task.id}`,
        title: t("任务等待完成确认"),
        body: language === "zh" ? `「${task.title}」${t("对方已确认完成，请你确认后进入评价。")}` : `"${task.title}" ${t("对方已确认完成，请你确认后进入评价。")}`,
        time: task.applicantCompletedAt ?? task.createdAt,
        status: t("进行中"),
      })),
    ...appliedTasks
      .filter((application) => application.status === "accepted" && application.task.status === "in_progress" && application.task.authorCompletedAt && !application.task.applicantCompletedAt)
      .map((application) => ({
        id: `applied-confirm-${application.id}`,
        title: t("任务等待完成确认"),
        body: language === "zh" ? `「${application.task.title}」${t("对方已确认完成，请你确认后进入评价。")}` : `"${application.task.title}" ${t("对方已确认完成，请你确认后进入评价。")}`,
        time: application.task.authorCompletedAt ?? application.createdAt,
        status: t("进行中"),
      })),
    ...[...postedTasks.filter((task) => task.status === "completed").map((task) => ({
      id: task.id,
      title: task.title,
      time: task.createdAt,
    })), ...appliedTasks.filter((application) => application.task.status === "completed").map((application) => ({
      id: application.taskId,
      title: application.task.title,
      time: application.createdAt,
    }))]
      .map((task) => ({
        id: `completed-${task.id}`,
        title: t("任务已完成，可进行评价"),
        body: language === "zh" ? `「${task.title}」${t("任务已完成，可进行评价")}` : `"${task.title}" ${t("任务已完成，可进行评价")}`,
        time: task.time,
        status: t("已完成"),
      })),
    ...receivedReviews.map((review) => ({
      id: `review-${review.id}`,
      title: t("收到新的评分"),
      body: t("你收到了一条新的星级评分。"),
      time: review.created_at,
      status: `${review.rating} ${t("星评价")}`,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()), [receivedApplications, appliedTasks, postedTasks, receivedReviews, language]);
  const unreadNotifications = taskNotifications.filter((item) => new Date(item.time).getTime() > messageReadAt).length;
  const isOwnSelectedTask = Boolean(user && selectedTask?.authorId === user.id);
  const selectedAcceptedApplication = useMemo(() => (
    selectedTask ? acceptedApplicationByTaskId.get(selectedTask.id) ?? null : null
  ), [acceptedApplicationByTaskId, selectedTask]);
  const selectedAppliedTask = useMemo(() => (
    selectedTask ? appliedTasks.find((application) => application.taskId === selectedTask.id) ?? null : null
  ), [appliedTasks, selectedTask]);
  const isAcceptedApplicantForSelectedTask = selectedAppliedTask?.status === "accepted";

  function requireAuth(action: () => void, message = "请先登录后继续") {
    if (!user) {
      flash(message);
      setShowLogin(true);
      return;
    }

    action();
  }

  async function loadTasks() {
    if (!supabase) return tasks;
    setIsLoadingTasks(true);
    let query = supabase
      .from("tasks")
      .select("*, profiles(display_name, avatar_initials, verified_uc_email)")
      .order("created_at", { ascending: false });

    query = user
      ? query.or(`status.eq.open,author_id.eq.${user.id}`)
      : query.eq("status", "open");

    const { data, error } = await query;

    setIsLoadingTasks(false);

    if (error) {
      flash("读取数据库失败，请稍后再试");
      return tasks;
    }

    const nextTasks = ((data ?? []) as TaskRow[]).map(mapTaskRow);
    setTasks(nextTasks);
    return nextTasks;
  }

  async function loadApplications() {
    if (!supabase || !user) return;

    const { data, error } = await supabase
      .from("applications")
      .select("*, tasks(id, author_id, title, school, mode, reward_amount, reward_type, status, author_completed_at, applicant_completed_at, created_at, profiles(display_name, contact_email, phone, wechat_id))")
      .eq("applicant_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      flash("读取申请记录失败");
      return;
    }

    setAppliedTasks(((data ?? []) as ApplicationRow[])
      .filter((row) => row.tasks?.author_id !== user.id)
      .map(mapApplicationRow)
      .filter((item): item is AppliedTask => Boolean(item)));
  }

  async function loadProfile() {
    if (!supabase || !user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, major, contact_email, phone, wechat_id")
      .eq("id", user.id)
      .single();

    if (error) return;

    setProfileContact({
      display_name: data.display_name ?? getUserName(user),
      major: data.major ?? "",
      contact_email: data.contact_email ?? user.email ?? "",
      phone: data.phone ?? "",
      wechat_id: data.wechat_id ?? "",
    });
  }

  async function loadReviews() {
    if (!supabase || !user) return;

    const [{ data: received, error: receivedError }, { data: mine, error: mineError }] = await Promise.all([
      supabase.from("reviews").select("*").eq("reviewee_id", user.id),
      supabase.from("reviews").select("*").eq("reviewer_id", user.id),
    ]);

    if (receivedError || mineError) {
      console.warn("Failed to load reviews", receivedError ?? mineError);
      setReceivedReviews([]);
      setMyReviews([]);
      setReviewSummary({ average: 0, count: 0 });
      return;
    }

    const receivedReviews = (received ?? []) as ReviewRow[];
    const total = receivedReviews.reduce((sum, review) => sum + review.rating, 0);
    setReviewSummary({
      average: receivedReviews.length ? total / receivedReviews.length : 0,
      count: receivedReviews.length,
    });
    setReceivedReviews(receivedReviews);
    setMyReviews((mine ?? []) as ReviewRow[]);
  }

  async function loadReceivedApplications() {
    if (!supabase || !user) return;

    const { data, error } = await supabase
      .from("applications")
      .select("*, profiles(display_name, avatar_initials, verified_uc_email, school, major, contact_email, phone, wechat_id), tasks(id, author_id, title, status)")
      .order("created_at", { ascending: false });

    if (error) {
      flash("读取收到的申请失败");
      return;
    }

    setReceivedApplications(((data ?? []) as ApplicationRow[])
      .filter((row) => row.tasks?.author_id === user.id)
      .map(mapReceivedApplicationRow)
      .filter((item): item is ReceivedApplication => Boolean(item)));
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function navigate(next: "home" | "publish" | "mine" | "profile" | "messages") {
    setView(next);
    setSelectedTask(null);
    setPublished(false);
    if (next === "messages") markMessagesRead();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markMessagesRead() {
    const now = Date.now();
    setMessageReadAt(now);
    window.localStorage.setItem("uc-connect-message-read-at", String(now));
  }

  function openProfile() {
    if (!user) {
      setShowLogin(true);
      return;
    }

    navigate("profile");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    navigate("home");
    flash("已退出登录");
  }

  async function saveProfileContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;

    const form = new FormData(event.currentTarget);
    const payload = {
      id: user.id,
      display_name: String(form.get("display_name") ?? getUserName(user)).trim() || getUserName(user),
      school: getUserSchool(user) === "未设置学校" ? "UCB" : getUserSchool(user),
      major: String(form.get("major") ?? "").trim() || null,
      contact_email: String(form.get("contact_email") ?? "").trim() || user.email || null,
      phone: String(form.get("phone") ?? "").trim() || null,
      wechat_id: String(form.get("wechat_id") ?? "").trim() || null,
      avatar_initials: getUserInitials(user),
      verified_uc_email: Boolean(user.email?.match(/@(berkeley|ucla|ucsd|ucsb|uci|ucdavis|ucsc|ucr|ucmerced)\.edu$/)),
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

    if (error) {
      flash(error.message);
      return;
    }

    setProfileContact({
      display_name: payload.display_name,
      major: payload.major ?? "",
      contact_email: payload.contact_email ?? "",
      phone: payload.phone ?? "",
      wechat_id: payload.wechat_id ?? "",
    });
    await refreshUserWorkflows();
    setShowEditProfile(false);
    flash("联系方式已保存");
  }

  async function signInWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!supabase) {
      flash("请先配置 Supabase 环境变量");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setShowLogin(false);
      flash("登录成功");
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: email.split("@")[0],
          school: "UC",
        },
      },
    });

    if (signUpError) {
      flash(signUpError.message);
      return;
    }

    const { error: retryError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (retryError) {
      flash("账号已创建，请再点一次登录");
      return;
    }

    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    setShowLogin(false);
    flash("注册并登录成功");
  }

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    if (!supabase || !user) {
      flash("请先登录后再发布需求");
      setShowLogin(true);
      return;
    }

    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const location = String(form.get("location") ?? "").trim();

    if (hasProhibitedContent(`${title} ${description}`)) {
      flash("该内容可能涉及平台禁止事项，请修改后再发布");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: user.email?.split("@")[0] ?? "UC Student",
      school: String(form.get("school")) as Task["school"],
      avatar_initials: (user.email?.slice(0, 2) ?? "UC").toUpperCase(),
      verified_uc_email: Boolean(user.email?.match(/@(berkeley|ucla|ucsd|ucsb|uci|ucdavis|ucsc|ucr|ucmerced)\.edu$/)),
    }, { onConflict: "id" });

    if (profileError) {
      flash(profileError.message);
      return;
    }

    const rewardType = String(form.get("reward_type"));
    const rewardAmount = Number(form.get("reward_amount") || 0);
    const payload = {
      author_id: user.id,
      title,
      description,
      school: String(form.get("school")) as Task["school"],
      category: String(form.get("category")),
      mode: String(form.get("mode")) as "线上" | "线下",
      reward_type: rewardType,
      reward_amount: rewardType === "paid" ? rewardAmount : null,
      location: location || "线上",
      due_date: String(form.get("due_date")) || null,
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert(payload)
      .select("*, profiles(display_name, avatar_initials, verified_uc_email)")
      .single();

    if (error) {
      flash(error.message);
      return;
    }

    const newTask = mapTaskRow(data as TaskRow);
    window.localStorage.removeItem("uc-connect-publish-draft");
    setPublishDraft({});
    setTasks((current) => [newTask, ...current]);
    setLastPublishedTask(newTask);
    setPublished(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveDraft(formElement: HTMLFormElement | null) {
    if (!formElement) return;

    const form = new FormData(formElement);
    const draft: PublishDraft = {
      title: String(form.get("title") ?? ""),
      category: String(form.get("category") ?? ""),
      school: String(form.get("school") ?? "UCB") as Task["school"],
      description: String(form.get("description") ?? ""),
      mode: String(form.get("mode") ?? "线下") as "线上" | "线下",
      location: String(form.get("location") ?? ""),
      due_date: String(form.get("due_date") ?? ""),
      reward_type: String(form.get("reward_type") ?? "paid") as "paid" | "mutual_help",
      reward_amount: String(form.get("reward_amount") ?? ""),
    };

    window.localStorage.setItem("uc-connect-publish-draft", JSON.stringify(draft));
    setPublishDraft(draft);
    flash("草稿已保存");
  }

  async function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTask) return;

    if (!supabase || !user) {
      flash("请先登录后再申请任务");
      setShowLogin(true);
      return;
    }

    if (selectedTask.authorId === user.id) {
      flash("不能申请自己发布的任务");
      return;
    }

    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("applications").insert({
      task_id: selectedTask.id,
      applicant_id: user.id,
      message: String(form.get("message")),
      available_time: String(form.get("available_time")),
    });

    if (error) {
      flash(error.code === "23505" ? "你已经申请过这个任务" : error.message);
      return;
    }

    setApplied(true);
    setShowApply(false);
    setTasks((current) => current.map((task) => (
      task.id === selectedTask.id ? { ...task, applicants: task.applicants + 1 } : task
    )));
    loadApplications();
  }

  async function refreshUserWorkflows() {
    const refreshedTasks = await loadTasks();
    if (selectedTask) {
      setSelectedTask(refreshedTasks.find((task) => task.id === selectedTask.id) ?? selectedTask);
    }
    if (user) {
      await loadApplications();
      await loadReceivedApplications();
      await loadReviews();
    }
  }

  async function handleApplicationDecision(application: ReceivedApplication, decision: "accepted" | "rejected") {
    if (!supabase || !user) return;

    if (decision === "accepted" && !window.confirm("接受这位申请人后，任务会进入进行中，其他待处理申请会自动标记为未通过。确认接受吗？")) {
      return;
    }

    const { error: applicationError } = await supabase
      .from("applications")
      .update({ status: decision })
      .eq("id", application.id);

    if (applicationError) {
      flash(applicationError.message);
      return;
    }

    if (decision === "accepted") {
      const { error: rejectOthersError } = await supabase
        .from("applications")
        .update({ status: "rejected" })
        .eq("task_id", application.taskId)
        .eq("status", "pending")
        .neq("id", application.id);

      if (rejectOthersError) {
        flash(rejectOthersError.message);
        return;
      }

      const { error: taskError } = await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", application.taskId);

      if (taskError) {
        flash(taskError.message);
        return;
      }
    }

    await refreshUserWorkflows();
    flash(decision === "accepted" ? "已接受申请，任务进入进行中" : "已拒绝申请");
  }

  async function updateTaskStatus(task: Task, status: TaskRow["status"]) {
    if (!supabase || !user) return;

    const message = status === "cancelled"
      ? "确认关闭这个任务吗？关闭后其他同学将不能继续申请。"
      : status === "completed"
        ? "确认任务已经完成吗？完成后可以进入评价流程。"
        : "确认更新任务状态吗？";

    if (!window.confirm(message)) return;

    const { error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", task.id);

    if (error) {
      flash(error.message);
      return;
    }

    await refreshUserWorkflows();
    flash(status === "completed" ? "任务已完成" : "任务状态已更新");
  }

  async function confirmTaskCompletion(task: Pick<Task, "id">) {
    if (!supabase || !user) return;

    if (!window.confirm("确认你已经完成这项任务吗？双方都确认后才会开放评价。")) return;

    const { error } = await supabase.rpc("confirm_task_completion", {
      target_task_id: task.id,
    });

    if (error) {
      flash(error.message);
      return;
    }

    const { data } = await supabase
      .from("tasks")
      .select("status")
      .eq("id", task.id)
      .single();
    await refreshUserWorkflows();
    const refreshed = data as Pick<TaskRow, "status"> | null;
    flash(refreshed?.status === "completed" ? "双方已确认，任务已完成" : "任务已确认，等待对方确认");
  }

  function openContactInfo(contact: ContactInfo) {
    if (!contact.email && !contact.phone && !contact.wechat) {
      flash("对方还没有填写联系方式");
      return;
    }

    setContactInfo(contact);
  }

  async function openPublicProfile(profileId?: string) {
    if (!supabase || !profileId) return;

    const [{ data: profile, error: profileError }, { data: reviews }, { data: posted }, { data: completedApplications }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, school, major, avatar_initials, verified_uc_email")
        .eq("id", profileId)
        .single(),
      supabase.from("reviews").select("rating").eq("reviewee_id", profileId),
      supabase.from("tasks").select("id").eq("author_id", profileId).eq("status", "completed"),
      supabase.from("applications").select("id, tasks(status)").eq("applicant_id", profileId).eq("status", "accepted"),
    ]);

    if (profileError || !profile) {
      flash("读取公开资料失败");
      return;
    }

    const receivedReviews = (reviews ?? []) as Pick<ReviewRow, "rating">[];
    const total = receivedReviews.reduce((sum, review) => sum + review.rating, 0);
    const acceptedCompletedCount = (completedApplications ?? []).filter((application) => {
      const taskValue = application.tasks as unknown;
      const task = Array.isArray(taskValue) ? taskValue[0] as Pick<TaskRow, "status"> | undefined : taskValue as Pick<TaskRow, "status"> | null;
      return task?.status === "completed";
    }).length;

    setPublicProfile({
      id: profile.id,
      name: profile.display_name,
      school: profile.school,
      major: profile.major,
      initials: profile.avatar_initials,
      verified: profile.verified_uc_email,
      rating: {
        average: receivedReviews.length ? total / receivedReviews.length : 0,
        count: receivedReviews.length,
      },
      completedCount: (posted?.length ?? 0) + acceptedCompletedCount,
    });
  }

  function contactFromApplication(application: ReceivedApplication): ContactInfo {
    return {
      name: application.applicantName,
      email: application.contactEmail,
      phone: application.phone,
      wechat: application.wechat,
    };
  }

  function contactFromAppliedTask(application: AppliedTask): ContactInfo {
    return application.author;
  }

  function hasReviewed(taskId: string, revieweeId: string) {
    return myReviews.some((review) => review.task_id === taskId && review.reviewee_id === revieweeId);
  }

  function openReviewTarget(target: { taskId: string; revieweeId: string; name: string }) {
    if (hasReviewed(target.taskId, target.revieweeId)) {
      flash("你已经评价过对方");
      return;
    }

    setSelectedRating(5);
    setReviewTarget(target);
  }

  async function submitRating() {
    if (!supabase || !user || !reviewTarget) return;

    const { error } = await supabase.from("reviews").insert({
      task_id: reviewTarget.taskId,
      reviewer_id: user.id,
      reviewee_id: reviewTarget.revieweeId,
      rating: selectedRating,
      comment: null,
    });

    if (error) {
      flash(error.code === "23505" ? "你已经评价过对方" : error.message);
      return;
    }

    setReviewTarget(null);
    await loadReviews();
    flash("评价已提交");
  }

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => navigate("home")} aria-label={t("返回首页")}>
            <span className="brand-mark"><i /><i /><i /></span>
            <span>UC Connect</span>
          </button>
          <nav className="desktop-nav" aria-label={t("主导航")}>
            <button className={view === "home" ? "nav-active" : ""} onClick={() => navigate("home")}>{t("发现任务")}</button>
            <button className={view === "mine" ? "nav-active" : ""} onClick={() => requireAuth(() => navigate("mine"), "请先登录后查看我的任务")}>{t("我的任务")}</button>
            <button className="message-nav-button" onClick={() => requireAuth(() => navigate("messages"), "请先登录后查看消息")}>{t("消息")}{unreadNotifications > 0 && <b>{unreadNotifications}</b>}</button>
          </nav>
          <div className="header-actions">
            <button className="lang-toggle" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>{language === "zh" ? "中文 / EN" : "EN / 中文"}</button>
            <button className="ghost-button" onClick={() => user ? flash(`已登录：${user.email}`) : setShowLogin(true)}>{user ? t("已登录") : t("登录")}</button>
            <button className="primary-button small" onClick={() => requireAuth(() => navigate("publish"), "请先登录后再发布需求")}>＋ {t("发布需求")}</button>
            <button className="profile-button" onClick={openProfile} aria-label={t("打开个人主页")}>{getUserInitials(user)}</button>
          </div>
        </div>
      </header>

      {view === "home" && (!selectedTask ? (
        <>
          <section className="hero">
            <div className="hero-grid">
              <div className="hero-copy">
                <h1>{t("让每一个需求，")}<br /><em>{t("找到对的人回应。")}</em></h1>
                <p>{t("连接 UC 校园里的同学，发布需求、分享经验、互相帮忙。简单一点，真诚一点。")}</p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => document.getElementById("task-list")?.scrollIntoView({ behavior: "smooth" })}>{t("浏览附近任务")} <span>→</span></button>
                  <button className="text-button" onClick={() => requireAuth(() => navigate("publish"), "请先登录后再发布需求")}>{t("我有一个需求")}</button>
                </div>
              </div>
              <div className="hero-board" aria-label="热门任务预览">
                <div className="board-top"><span>{t("最新任务")}</span><span className="live-dot">{t("数据库同步")}</span></div>
                {(featuredTasks.length ? featuredTasks : demoTasks.slice(0, 3)).map((task) => (
                  <button className="feature-task" key={task.id} onClick={() => setSelectedTask(task)}>
                    <div className={`task-icon ${task.tone}`}>{task.mode === "线上" ? "◎" : "⌁"}</div>
                    <div><span className="mini-label">{task.school} · {tv(task.category)}</span><h3>{task.title}</h3><p>{tv(task.time)} · {task.applicants} {t("人申请")}</p></div>
                    <strong className={task.reward.includes("互助") ? "free" : ""}>{tv(task.reward)}</strong>
                  </button>
                ))}
                <div className="board-footer"><span></span><span>♡</span></div>
              </div>
            </div>
          </section>

          <section className="task-section" id="task-list">
            <div className="section-heading">
              <div><span className="section-kicker">EXPLORE</span><h2>{t("发现正在发生的需求")}</h2></div>
              <div className="school-tabs">
                {["全部 UC", "UCB", "UCSD", "UCLA"].map((item) => <button key={item} className={school === item ? "active" : ""} onClick={() => setSchool(item)}>{tv(item)}</button>)}
              </div>
            </div>
            <div className="filter-row">
              <div className="category-tabs">
                {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{t(item)}</button>)}
              </div>
              <label className="search-box"><span>⌕</span><input aria-label={t("搜索任务")} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("搜索任务")} /></label>
            </div>
            <div className="task-grid">
              {isLoadingTasks && <div className="empty-state"><span>⌕</span><h3>{t("正在读取任务")}</h3><p>{t("连接 Supabase 数据库中。")}</p></div>}
              {filtered.map((task) => (
                <button className="task-card" key={task.id} onClick={() => { setSelectedTask(task); window.scrollTo(0, 0); }}>
                  <div className="card-meta"><span className={`school-badge ${task.school.toLowerCase()}`}>{task.school}</span><span>{task.time}</span></div>
                  <h3>{task.title}</h3>
                  <p className="task-desc">{task.description}</p>
                  <div className="task-tags"><span>{tv(task.category)}</span><span>{tv(task.mode)}</span></div>
                  <div className="card-footer">
                    <span className="user-chip"><i>{task.avatar}</i><span>{task.author}{task.verified && <b title={t("学校邮箱已认证")}>✓</b>}</span></span>
                    <span className="reward">{tv(task.reward)}</span>
                  </div>
                  <div className="applicant-line"><span>{task.applicants} {t("人已申请")}</span><span>{t("查看详情")} →</span></div>
                </button>
              ))}
              {filtered.length === 0 && <div className="empty-state"><span>⌕</span><h3>{t("暂时没有匹配的任务")}</h3><p>{t("换个学校或关键词试试。")}</p></div>}
            </div>
          </section>

          <section className="how-it-works">
            <span className="section-kicker">HOW IT WORKS</span><h2>{t("三步，找到你的校园连接")}</h2>
            <div className="step-grid">
              <div><b>01</b><span className="step-icon">＋</span><h3>{t("发布一个需求")}</h3><p>{t("说清楚你需要什么、时间和地点。")}</p></div>
              <div><b>02</b><span className="step-icon">⌁</span><h3>{t("选择合适的同学")}</h3><p>{t("查看申请说明和学校认证信息。")}</p></div>
              <div><b>03</b><span className="step-icon">✓</span><h3>{t("完成并互相评价")}</h3><p>{t("确认完成，给认真帮助的人一点认可。")}</p></div>
            </div>
          </section>
        </>
      ) : (
        <section className="detail-page">
          <button className="back-button" onClick={() => { setSelectedTask(null); setShowApply(false); setApplied(false); }}>← {t("返回任务列表")}</button>
          <div className="detail-layout">
            <article className="detail-main">
              <div className="detail-meta"><span className={`school-badge ${selectedTask.school.toLowerCase()}`}>{selectedTask.school}</span><span>{tv(selectedTask.category)}</span><span>·</span><span>{tv(selectedTask.time)}</span></div>
              <h1>{selectedTask.title}</h1>
              <div className="detail-author"><i>{selectedTask.avatar}</i><span><strong>{selectedTask.author} {selectedTask.verified && <b>✓ {t("已认证")}</b>}</strong><small>{t("完成任务后可互相评分")}</small></span>{selectedTask.authorId && <button className="mini-action" onClick={() => openPublicProfile(selectedTask.authorId)}>{t("查看资料")}</button>}</div>
              <div className="detail-facts">
                <div><span>{t("地点")}</span><strong>{selectedTask.location}</strong></div>
                <div><span>{t("希望完成")}</span><strong>{tv(selectedTask.due)}</strong></div>
                <div><span>{t("任务形式")}</span><strong>{tv(selectedTask.mode)}</strong></div>
              </div>
              <div className="detail-copy"><h2>{t("需求说明")}</h2><p>{selectedTask.description}</p><p>{t("申请时可以简单介绍你的时间安排。如果有相关经验，也请一起说明。")}</p></div>
              <div className="safety-note"><span>◇</span><div><strong>{t("安全提醒")}</strong><p>{t("请勿提前转账或分享敏感个人信息。接受申请后再交换联系方式。")}</p></div></div>
            </article>
            <aside className="apply-card">
              <span>{t("任务报酬")}</span><strong>{tv(selectedTask.reward)}</strong><small>{t("平台暂不处理真实付款")}</small>
              <hr />
              <div className="apply-stat"><span>{t("已有申请")}</span><b>{selectedTask.applicants}</b></div>
              {isOwnSelectedTask && <button className="primary-button wide" onClick={() => { setMineTab("posted"); setManagedTaskId(selectedTask.id); navigate("mine"); }}>{t("管理任务")}</button>}
              {isOwnSelectedTask && selectedTask.applicants > 0 && <button className="ghost-outline wide-action" onClick={() => { setMineTab("posted"); setManagedTaskId(selectedTask.id); navigate("mine"); }}>{t("查看申请")}（{selectedTask.applicants}）</button>}
              {isOwnSelectedTask && selectedTask.status === "in_progress" && <button className="ghost-outline wide-action" onClick={() => selectedAcceptedApplication ? openContactInfo(contactFromApplication(selectedAcceptedApplication)) : flash("还没有已接受的申请人")}>{t("联系对方")}</button>}
              {isOwnSelectedTask && selectedTask.status === "in_progress" && <button className="ghost-outline wide-action" onClick={() => selectedTask.authorCompletedAt ? flash("你已确认完成") : confirmTaskCompletion(selectedTask)}>{selectedTask.authorCompletedAt ? t("等待对方确认") : t("确认完成")}</button>}
              {isOwnSelectedTask && selectedTask.status === "completed" && <button className="ghost-outline wide-action" onClick={() => selectedAcceptedApplication ? openReviewTarget({ taskId: selectedTask.id, revieweeId: selectedAcceptedApplication.applicantId, name: selectedAcceptedApplication.applicantName }) : flash("还没有已接受的申请人")}>{selectedAcceptedApplication && hasReviewed(selectedTask.id, selectedAcceptedApplication.applicantId) ? t("已评价") : t("评价对方")}</button>}
              {!isOwnSelectedTask && selectedAppliedTask && <div className="success-box"><span>✓</span><strong>{tv(formatApplicationStatus(selectedAppliedTask.status))}</strong><p>{selectedAppliedTask.status === "accepted" ? t("双方确认后才会进入已完成并开放评价。") : t("发布者选择后会通知你。")}</p></div>}
              {!isOwnSelectedTask && isAcceptedApplicantForSelectedTask && <button className="ghost-outline wide-action" onClick={() => openContactInfo(contactFromAppliedTask(selectedAppliedTask!))}>{t("联系对方")}</button>}
              {!isOwnSelectedTask && isAcceptedApplicantForSelectedTask && selectedAppliedTask?.task.status === "in_progress" && <button className="ghost-outline wide-action" onClick={() => selectedAppliedTask.task.applicantCompletedAt ? flash("你已确认完成") : confirmTaskCompletion({ id: selectedAppliedTask.taskId })}>{selectedAppliedTask.task.applicantCompletedAt ? t("等待对方确认") : t("确认完成")}</button>}
              {!isOwnSelectedTask && isAcceptedApplicantForSelectedTask && selectedAppliedTask?.task.status === "completed" && <button className="ghost-outline wide-action" onClick={() => openReviewTarget({ taskId: selectedAppliedTask.taskId, revieweeId: selectedAppliedTask.task.authorId, name: selectedAppliedTask.author.name })}>{hasReviewed(selectedAppliedTask.taskId, selectedAppliedTask.task.authorId) ? t("已评价") : t("评价发布者")}</button>}
              {!isOwnSelectedTask && !selectedAppliedTask && !showApply && !applied && <button className="primary-button wide" onClick={() => requireAuth(() => setShowApply(true), "请先登录后再申请任务")}>{t("申请接取")}</button>}
              {!isOwnSelectedTask && showApply && !applied && <form onSubmit={handleApply} className="apply-form">
                <label>{t("申请说明")}<textarea required name="message" placeholder={t("介绍一下你为什么适合，以及可以完成的时间…")} /></label>
                <label>{t("可完成时间")}<input required name="available_time" placeholder={t("例如：周三下午")} /></label>
                <button className="primary-button wide" type="submit">{t("提交申请")}</button>
                <button className="text-button wide" type="button" onClick={() => setShowApply(false)}>{t("取消")}</button>
              </form>}
              {applied && <div className="success-box"><span>✓</span><strong>{t("申请已提交")}</strong><p>{t("发布者选择后会通知你。")}</p></div>}
              <button className="report-button" onClick={() => flash("举报功能即将开放")}>⚑ {t("举报此任务")}</button>
            </aside>
          </div>
        </section>
      ))}

      {view === "publish" && (
        <section className="app-page publish-page">
          <div className="page-intro">
            <button className="back-button" onClick={() => navigate("home")}>← {t("返回发现")}</button>
            <span className="section-kicker">NEW REQUEST</span>
            <h1>{t("发布一个需求")}</h1>
            <p>{t("描述得越清楚，越容易找到合适的同学。")}</p>
          </div>
          {!published ? (
            <form className="publish-form" onSubmit={handlePublish}>
              <div className="form-section">
                <span className="form-step">01</span><div><h2>{t("基本信息")}</h2><p>{t("先让大家一眼看懂你需要什么。")}</p></div>
                <div className="form-fields full-row">
                  <label className="field-wide">{t("需求标题")}<input required name="title" defaultValue={publishDraft.title ?? ""} placeholder={t("例如：帮忙实拍宿舍公共区域")} /></label>
                  <label>{t("任务类别")}<select required name="category" defaultValue={publishDraft.category ?? ""}><option value="" disabled>{t("请选择")}</option><option>校园实拍</option><option>新生落地</option><option>经验咨询</option><option>校园互助</option><option>校园信息</option></select></label>
                  <label>{t("所属学校")}<select required name="school" defaultValue={publishDraft.school ?? "UCB"}><option>UCB</option><option>UCSD</option><option>UCLA</option></select></label>
                  <label className="field-wide">{t("详细说明")}<textarea required name="description" defaultValue={publishDraft.description ?? ""} placeholder={t("具体需要做什么？有没有特别需要注意的地方？")} /></label>
                </div>
              </div>
              <div className="form-section">
                <span className="form-step">02</span><div><h2>{t("时间与地点")}</h2><p>{t("告诉申请者在哪里、什么时候完成。")}</p></div>
                <div className="form-fields full-row">
                  <label>{t("任务形式")}<select name="mode" value={publishMode} onChange={(event) => setPublishMode(event.target.value as "线上" | "线下")}><option value="线下">{t("线下")}</option><option value="线上">{t("线上")}</option></select></label>
                  <label>{t("任务范围")}<select><option>{t("本校学生")}</option><option>{t("所有 UC 学生")}</option></select></label>
                  <label>{publishMode === "线上" ? t("线上方式") : t("地点")}<input required={publishMode === "线下"} name="location" defaultValue={publishDraft.location ?? ""} placeholder={publishMode === "线上" ? t("例如：Zoom / 微信语音，可留空") : t("例如：Blackwell Hall")} /></label>
                  <label>{t("希望完成时间")}<input required name="due_date" type="date" defaultValue={publishDraft.due_date ?? "2026-08-08"} /></label>
                </div>
              </div>
              <div className="form-section">
                <span className="form-step">03</span><div><h2>{t("报酬说明")}</h2><p>{t("平台暂不处理真实付款。")}</p></div>
                <div className="form-fields full-row">
                  <label>{t("需求类型")}<select name="reward_type" value={rewardType} onChange={(event) => setRewardType(event.target.value as "paid" | "mutual_help")}><option value="paid">{t("有偿任务")}</option><option value="mutual_help">{t("免费互助")}</option></select></label>
                  <label>{t("报酬金额")}<div className="money-input"><span>$</span><input disabled={rewardType === "mutual_help"} required={rewardType === "paid"} name="reward_amount" type="number" min="0" defaultValue={publishDraft.reward_amount ?? ""} placeholder={rewardType === "paid" ? "25" : t("免费互助无需填写")} /></div></label>
                </div>
              </div>
              <label className="agreement"><input required type="checkbox" /> {t("我确认该需求不涉及代写、代考、换汇、违法服务或其他平台禁止内容。")}</label>
              <div className="form-actions"><button type="button" className="ghost-outline" onClick={(event) => saveDraft(event.currentTarget.form)}>{t("保存草稿")}</button><button className="primary-button" type="submit">{t("发布需求")} →</button></div>
            </form>
          ) : (
            <div className="publish-success"><span>✓</span><h2>{t("需求已发布")}</h2><p>{t("你的任务现在会出现在对应校园的任务流中。")}</p><div className="preview-ticket"><span className={`school-badge ${(lastPublishedTask?.school ?? "UCB").toLowerCase()}`}>{lastPublishedTask?.school ?? "UCB"}</span><h3>{lastPublishedTask?.title ?? t("新的校园需求")}</h3><small>{t("刚刚")} · {t("等待第一位申请者")}</small></div><button className="primary-button" onClick={() => navigate("mine")}>{t("前往我的任务")}</button><button className="text-button" onClick={() => navigate("home")}>{t("返回首页")}</button></div>
          )}
        </section>
      )}

      {view === "mine" && (
        <section className="app-page mine-page">
          <div className="page-intro compact"><span className="section-kicker">MY TASKS</span><h1>{t("我的任务")}</h1><p>{t("在这里跟进你发布和申请的所有需求。")}</p></div>
          <div className="mine-tabs"><button className={mineTab === "posted" ? "active" : ""} onClick={() => setMineTab("posted")}>{t("我发布的")} <b>{postedTasks.length}</b></button><button className={mineTab === "applied" ? "active" : ""} onClick={() => setMineTab("applied")}>{t("我申请的")} <b>{appliedTasks.length}</b></button></div>
          {mineTab === "posted" ? (
            <div className="dashboard-layout">
              <div className="status-cards"><button className={taskStatusFilter === "open" ? "active" : ""} onClick={() => setTaskStatusFilter(taskStatusFilter === "open" ? "all" : "open")}><span>{t("招募中")}</span><strong>{openPostedCount}</strong><small>{t("共")} {postedTasks.reduce((sum, task) => sum + task.applicants, 0)} {t("份申请")}</small></button><button className={taskStatusFilter === "in_progress" ? "active" : ""} onClick={() => setTaskStatusFilter(taskStatusFilter === "in_progress" ? "all" : "in_progress")}><span>{t("进行中")}</span><strong>{inProgressPostedCount}</strong><small>{t("等待双方完成")}</small></button><button className={taskStatusFilter === "completed" ? "active" : ""} onClick={() => setTaskStatusFilter(taskStatusFilter === "completed" ? "all" : "completed")}><span>{t("已完成")}</span><strong>{completedPostedCount}</strong><small>{t("可查看记录和评价")}</small></button></div>
              <div className="task-table">
                <div className="table-title"><h2>{t("最近发布")}</h2><button onClick={() => navigate("publish")}>＋ {t("新需求")}</button></div>
                {visiblePostedTasks.map((task) => (
                  <div className="task-row manage-row" key={task.id}><span className={`status ${task.status === "open" ? "open" : task.status === "completed" ? "progress" : "waiting"}`}>{tv(formatTaskStatus(task.status))}</span><div><strong>{task.title}</strong><small>{task.school} · {tv(task.category)} · {task.applicants} {t("份申请")}</small></div><b>{tv(task.reward)}</b><div className="row-actions"><button onClick={() => { navigate("home"); setSelectedTask(task); }}>{t("查看详情")}</button>{task.applicants > 0 && <button className="action-strong" onClick={() => setManagedTaskId(managedTaskId === task.id ? null : task.id)}>{t("查看申请")}（{task.applicants}）</button>}{task.status === "open" && <button onClick={() => flash("编辑功能待上线")}>{t("编辑")}</button>}{task.status === "open" && <button onClick={() => updateTaskStatus(task, "cancelled")}>{t("关闭招募")}</button>}{task.status === "in_progress" && <button onClick={() => { const accepted = acceptedApplicationByTaskId.get(task.id); accepted ? openContactInfo(contactFromApplication(accepted)) : flash("还没有已接受的申请人"); }}>{t("联系对方")}</button>}{task.status === "in_progress" && <button onClick={() => task.authorCompletedAt ? flash("你已确认完成") : confirmTaskCompletion(task)}>{task.authorCompletedAt ? t("等待对方确认") : t("确认完成")}</button>}{task.status === "cancelled" && <button onClick={() => flash("已关闭的任务不能继续操作")}>{t("查看记录")}</button>}{task.status === "completed" && <button onClick={() => { const accepted = acceptedApplicationByTaskId.get(task.id); accepted ? openReviewTarget({ taskId: task.id, revieweeId: accepted.applicantId, name: accepted.applicantName }) : flash("还没有已接受的申请人"); }}>{acceptedApplicationByTaskId.get(task.id) && hasReviewed(task.id, acceptedApplicationByTaskId.get(task.id)!.applicantId) ? t("已评价") : t("评价对方")}</button>}</div></div>
                ))}
                {visiblePostedTasks.length === 0 && <div className="empty-state"><span>＋</span><h3>{t("没有对应状态的任务")}</h3><p>{t("发布或切换状态筛选后，会显示在这里。")}</p></div>}
              </div>
              {managedTaskId && <section className="application-panel"><div className="table-title"><h2>{t("申请管理")}</h2><span>{managedTaskApplications.length} {t("份申请")}</span></div>{managedTaskApplications.length === 0 ? <div className="empty-state"><span>⌕</span><h3>{t("暂无申请")}</h3><p>{t("有同学申请后会出现在这里。")}</p></div> : managedTaskApplications.map((application) => <article className="application-card" key={application.id}><div className="application-head"><i>{application.applicantAvatar}</i><div><strong>{application.applicantName} {application.applicantVerified && <b>✓</b>}</strong><small>{application.applicantSchool} · {application.applicantMajor} · {tv(formatRelativeTime(application.createdAt))}</small></div><button className="mini-action" onClick={() => openPublicProfile(application.applicantId)}>{t("查看资料")}</button><span className={`status ${application.status === "pending" ? "waiting" : "progress"}`}>{tv(formatApplicationStatus(application.status))}</span></div><p>{application.message}</p><dl><div><dt>{t("可完成时间")}</dt><dd>{application.availableTime}</dd></div><div><dt>{t("信用评价")}</dt><dd>{t("暂无评分")}</dd></div></dl>{application.status === "pending" && <div className="application-actions"><button className="primary-button small" onClick={() => handleApplicationDecision(application, "accepted")}>{t("接受")}</button><button className="ghost-outline" onClick={() => handleApplicationDecision(application, "rejected")}>{t("拒绝")}</button></div>}{application.status === "accepted" && <div className="application-actions"><button className="primary-button small" onClick={() => openContactInfo(contactFromApplication(application))}>{t("联系对方")}</button></div>}</article>)}</section>}
            </div>
          ) : (
            <div className="task-table applied-table">
              <div className="table-title"><h2>{t("申请记录")}</h2><span>{t("状态有变化时会收到提醒")}</span></div>
              {appliedTasks.map((application) => (
                <div className="task-row" key={application.id}><span className={`status ${application.status === "pending" ? "waiting" : "progress"}`}>{tv(formatApplicationStatus(application.status))}</span><div><strong>{application.task.title}</strong><small>{application.task.school} · {tv(application.task.mode)} · {t("申请于")} {tv(formatRelativeTime(application.createdAt))}</small></div><b>{tv(application.task.reward)}</b><div className="row-actions">{application.status === "accepted" && <button className="action-strong" onClick={() => openContactInfo(contactFromAppliedTask(application))}>{t("联系对方")}</button>}{application.status === "accepted" && application.task.status === "in_progress" && <button onClick={() => application.task.applicantCompletedAt ? flash("你已确认完成") : confirmTaskCompletion({ id: application.taskId })}>{application.task.applicantCompletedAt ? t("等待对方确认") : t("确认完成")}</button>}{application.status === "accepted" && application.task.status === "completed" && <button onClick={() => openReviewTarget({ taskId: application.taskId, revieweeId: application.task.authorId, name: application.author.name })}>{hasReviewed(application.taskId, application.task.authorId) ? t("已评价") : t("评价发布者")}</button>}<button onClick={() => { navigate("home"); setSelectedTask(tasks.find((task) => task.id === application.taskId) ?? null); }}>{t("查看详情")}</button></div></div>
              ))}
              {appliedTasks.length === 0 && <div className="empty-state"><span>⌕</span><h3>{t("还没有申请记录")}</h3><p>{t("申请任务后，会显示在这里。")}</p></div>}
            </div>
          )}
        </section>
      )}

      {view === "messages" && (
        <section className="app-page messages-page">
          <div className="page-intro compact"><span className="section-kicker">MESSAGES</span><h1>{t("消息")}</h1><p>{t("任务申请和状态更新会出现在这里。")}</p></div>
          <div className="message-tabs"><button className="active">{t("任务通知")} <b>{taskNotifications.length}</b></button><button onClick={() => flash("聊天消息下一步接入")}>{t("聊天消息")}</button></div>
          <div className="task-table message-list">
            <div className="table-title"><h2>{t("任务通知")}</h2><span>{unreadNotifications > 0 ? `${unreadNotifications} ${t("条未读")}` : t("已全部读完")}</span></div>
            {taskNotifications.map((notification) => (
              <article className="message-item" key={notification.id}><span className="message-dot" /><div><strong>{notification.title}</strong><p>{notification.body}</p><small>{notification.status} · {tv(formatRelativeTime(notification.time))}</small></div></article>
            ))}
            {taskNotifications.length === 0 && <div className="empty-state"><span>◇</span><h3>{t("还没有消息")}</h3><p>{t("任务申请和状态更新会出现在这里。")}</p></div>}
          </div>
        </section>
      )}

      {view === "profile" && (
        <section className="app-page profile-page">
          <div className="profile-hero"><div className="profile-avatar">{getUserInitials(user)}</div><div><span className="verified-pill">✓ {t("已登录")}</span><h1>{profileContact.display_name || getUserName(user)}</h1><p>{tv(getUserSchool(user))} · {user?.email}</p></div><div className="profile-hero-actions"><button className="ghost-outline" onClick={() => setShowEditProfile(true)}>{t("编辑资料")}</button><button className="ghost-outline" onClick={signOut}>{t("退出登录")}</button></div></div>
          <div className="profile-layout">
            <aside className="profile-sidebar"><h3>{t("资料摘要")}</h3><p>{t("联系方式只会在双方匹配后展示给对方，不会出现在公开任务列表。")}</p><dl><div><dt>{t("显示名称")}</dt><dd>{profileContact.display_name || getUserName(user)}</dd></div><div><dt>{t("专业")}</dt><dd>{profileContact.major || t("未填写")}</dd></div><div><dt>{t("联系邮箱")}</dt><dd>{profileContact.contact_email || user?.email || t("未填写")}</dd></div><div><dt>{t("手机号")}</dt><dd>{profileContact.phone || t("未填写")}</dd></div><div><dt>{t("微信号")}</dt><dd>{profileContact.wechat_id || t("未填写")}</dd></div><div><dt>{t("所在校区")}</dt><dd>{tv(getUserSchool(user))}</dd></div></dl></aside>
            <div className="profile-content"><div className="profile-stats"><div><strong>{postedTasks.length}</strong><span>{t("发布任务")}</span></div><div><strong>{appliedTasks.length}</strong><span>{t("申请任务")}</span></div><div><strong>{completedPostedCount}</strong><span>{t("完成任务")}</span></div></div><div className="reviews"><div className="table-title"><h2>{t("收到的评价")}</h2><span>{reviewSummary.count > 0 ? `${reviewSummary.count} ${t("条评分")}` : t("暂无评分")}</span></div>{reviewSummary.count > 0 ? <div className="rating-summary"><strong>{reviewSummary.average.toFixed(1)}</strong><span>{renderStars(Math.round(reviewSummary.average))}</span><small>{t("基于")} {reviewSummary.count} {t("条评分")}</small></div> : <div className="empty-state"><span>☆</span><h3>{t("还没有评分")}</h3><p>{t("完成任务后，对方给你的星级会显示在这里。")}</p></div>}</div></div>
          </div>
        </section>
      )}

      <nav className="mobile-nav" aria-label="移动端导航"><button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}><span>⌕</span>{t("发现任务")}</button><button className={view === "mine" ? "active" : ""} onClick={() => requireAuth(() => navigate("mine"), "请先登录后查看我的任务")}><span>▤</span>{t("我的任务")}</button><button className="mobile-add" onClick={() => requireAuth(() => navigate("publish"), "请先登录后再发布需求")}>＋</button><button className={view === "messages" ? "active" : ""} onClick={() => requireAuth(() => navigate("messages"), "请先登录后查看消息")}><span>◇</span>{t("消息")}</button><button className={view === "profile" ? "active" : ""} onClick={openProfile}><span>○</span>{t("我的")}</button></nav>

      <footer><div className="footer-inner"><span className="brand footer-brand"><span className="brand-mark"><i /><i /><i /></span><span>UC Connect</span></span><p>{t("连接每一个 UC 校园，让需求找到回应。")}</p><span>UC Connect · 2026</span></div></footer>
      {notice && <div className="toast">{tv(notice)}</div>}
      {showLogin && <div className="modal-backdrop" onMouseDown={() => setShowLogin(false)}><section className="login-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowLogin(false)}>×</button><span className="brand-mark login-logo"><i /><i /><i /></span><h2>{t("欢迎来到 UC Connect")}</h2><p>{t("登录后即可发布需求、提交申请和管理任务。")}</p><button className="sso-button" onClick={() => flash("Google 登录可以下一步接入")}>G&nbsp;&nbsp; {t("使用 Google 登录")}</button><div className="or"><span />{t("或")}<span /></div><form onSubmit={signInWithPassword}><label>{t("邮箱地址")}<input required name="email" placeholder="name@berkeley.edu" type="email" /></label><label>{t("密码")}<input required name="password" minLength={6} placeholder={t("至少 6 位密码")} type="password" /></label><button className="primary-button wide" type="submit">{t("登录 / 注册")}</button></form><small>{t("新邮箱会自动创建账号。使用学校邮箱可获得 UC 认证标志。")}</small></section></div>}
      {showEditProfile && <div className="modal-backdrop" onMouseDown={() => setShowEditProfile(false)}><section className="login-modal edit-profile-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowEditProfile(false)}>×</button><span className="brand-mark login-logo"><i /><i /><i /></span><h2>{t("编辑资料")}</h2><p>{t("这些联系方式只会在双方匹配后展示给对方。")}</p><form className="profile-contact-form" key={`edit-${profileContact.display_name}-${profileContact.contact_email}-${profileContact.phone}-${profileContact.wechat_id}`} onSubmit={saveProfileContact}><label>{t("显示名称")}<input name="display_name" defaultValue={profileContact.display_name || getUserName(user)} /></label><label>{t("专业")}<input name="major" defaultValue={profileContact.major} placeholder={t("例如：Data Science")} /></label><label>{t("联系邮箱")}<input name="contact_email" type="email" defaultValue={profileContact.contact_email || user?.email || ""} /></label><label>{t("手机号")}<input name="phone" defaultValue={profileContact.phone} placeholder={t("可选")} /></label><label>{t("微信号")}<input name="wechat_id" defaultValue={profileContact.wechat_id} placeholder={t("可选")} /></label><button className="primary-button wide" type="submit">{t("保存资料")}</button></form><small>{t("建议至少填写邮箱或微信，方便任务匹配后联系。")}</small></section></div>}
      {publicProfile && <div className="modal-backdrop" onMouseDown={() => setPublicProfile(null)}><section className="login-modal public-profile-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setPublicProfile(null)}>×</button><div className="public-profile-head"><i>{publicProfile.initials}</i><span><small>{t("公开资料")}</small><h2>{publicProfile.name} {publicProfile.verified && <b>✓</b>}</h2><p>{publicProfile.school} · {publicProfile.major || t("未填写")}</p></span></div><div className="public-stats"><div><strong>{publicProfile.completedCount}</strong><span>{t("完成次数")}</span></div><div><strong>{publicProfile.rating.count ? publicProfile.rating.average.toFixed(1) : "-"}</strong><span>{t("平均评分")}</span></div><div><strong>{publicProfile.rating.count}</strong><span>{t("条评分")}</span></div></div><p className="profile-note">{t("联系方式仅在任务匹配后展示。")}</p></section></div>}
      {contactInfo && <div className="modal-backdrop" onMouseDown={() => setContactInfo(null)}><section className="login-modal contact-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setContactInfo(null)}>×</button><span className="brand-mark login-logo"><i /><i /><i /></span><h2>{t("联系")} {contactInfo.name}</h2><p>{t("UC Connect 暂不提供站内实时聊天，请通过对方公开给匹配对象的联系方式沟通。")}</p><div className="contact-list"><div><span>{t("邮箱")}</span><strong>{contactInfo.email || t("未填写")}</strong></div><div><span>{t("手机号")}</span><strong>{contactInfo.phone || t("未填写")}</strong></div><div><span>{t("微信号")}</span><strong>{contactInfo.wechat || t("未填写")}</strong></div></div><small>{t("请勿提前转账或分享敏感个人信息。建议先确认任务范围和交付方式。")}</small></section></div>}
      {reviewTarget && <div className="modal-backdrop" onMouseDown={() => setReviewTarget(null)}><section className="login-modal rating-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setReviewTarget(null)}>×</button><span className="brand-mark login-logo"><i /><i /><i /></span><h2>{t("评价")} {reviewTarget.name}</h2><p>{t("这次先只打星，不写评论。")}</p><div className="star-picker" role="radiogroup" aria-label={t("评分")}>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={value <= selectedRating ? "active" : ""} onClick={() => setSelectedRating(value)} aria-label={`${value} ${t("评分")}`}>★</button>)}</div><button className="primary-button wide" onClick={submitRating}>{t("提交")} {selectedRating} {t("星评价")}</button></section></div>}
    </main>
  );
}
