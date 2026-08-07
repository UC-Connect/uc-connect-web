"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { User } from "@supabase/supabase-js";
import { ApplicationRow, supabase, TaskRow } from "@/lib/supabase";

type Task = {
  id: string;
  authorId?: string;
  title: string;
  school: "UCB" | "UCSD" | "UCLA";
  category: string;
  mode: string;
  reward: string;
  time: string;
  applicants: number;
  author: string;
  verified: boolean;
  avatar: string;
  description: string;
  location: string;
  due: string;
  tone: string;
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
    applicants: 3,
    author: "Mia Chen",
    verified: true,
    avatar: "MC",
    description: "我是今年 Fall 入学的新生，想提前看看 Blackwell Hall 的公共厨房、洗衣房和一楼学习区。希望可以拍 8–10 张清晰照片，再简单说一下晚上是否吵。",
    location: "UC Berkeley · Blackwell Hall",
    due: "8 月 8 日前",
    tone: "blue",
  },
  {
    id: "demo-2",
    title: "想咨询 Math-CS 转 Data Science 的选课规划",
    school: "UCSD",
    category: "经验咨询",
    mode: "线上",
    reward: "$18",
    time: "28 分钟前",
    applicants: 5,
    author: "Eason L.",
    verified: false,
    avatar: "EL",
    description: "目前是二年级 Math-CS，正在考虑转 Data Science。想找一位了解两个专业课程设置的学长学姐聊 30 分钟，主要讨论先修课、毕业时间和实习准备。",
    location: "线上 · Zoom / 微信语音",
    due: "本周内",
    tone: "teal",
  },
  {
    id: "demo-3",
    title: "新生到校，求一起熟悉 Westwood 周边",
    school: "UCLA",
    category: "新生落地",
    mode: "线下",
    reward: "免费互助",
    time: "1 小时前",
    applicants: 2,
    author: "Sophie Wu",
    verified: true,
    avatar: "SW",
    description: "刚到 UCLA，想找同学一起走一遍超市、公交站和常用餐厅。我也可以请你喝奶茶，希望大概一小时左右。",
    location: "UCLA · Westwood",
    due: "8 月 10 日",
    tone: "gold",
  },
  {
    id: "demo-4",
    title: "借一个 TI-84 计算器参加周五考试",
    school: "UCB",
    category: "校园互助",
    mode: "线下",
    reward: "$10",
    time: "2 小时前",
    applicants: 1,
    author: "Jason Y.",
    verified: true,
    avatar: "JY",
    description: "计算器突然坏了，需要借用周五一天。可以在 Sather Gate 附近取还，会好好保管。",
    location: "UC Berkeley · Sather Gate",
    due: "本周五",
    tone: "violet",
  },
  {
    id: "demo-5",
    title: "请分享一次 UCLA 校内研究申请经验",
    school: "UCLA",
    category: "经验咨询",
    mode: "线上",
    reward: "$20",
    time: "今天 09:40",
    applicants: 4,
    author: "Lina Zhang",
    verified: false,
    avatar: "LZ",
    description: "准备秋季申请校内 research，希望找成功加入 lab 的同学聊聊 cold email、简历和面试经验。",
    location: "线上",
    due: "下周前",
    tone: "coral",
  },
  {
    id: "demo-6",
    title: "求帮忙确认 Sixth College 附近自行车停车位",
    school: "UCSD",
    category: "校园信息",
    mode: "线下",
    reward: "$12",
    time: "今天 08:15",
    applicants: 0,
    author: "Kevin H.",
    verified: true,
    avatar: "KH",
    description: "准备买自行车，想知道 Catalyst 附近晚上可用的停车架多不多，最好能拍两张照片。",
    location: "UCSD · Sixth College",
    due: "三天内",
    tone: "teal",
  },
];

const categories = ["全部任务", "校园实拍", "新生落地", "经验咨询", "校园互助", "校园信息"];

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
  task: {
    title: string;
    school: Task["school"];
    mode: string;
    reward: string;
    createdAt: string;
  };
};

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
    applicants: row.applications_count,
    author: row.profiles?.display_name ?? "UC Student",
    verified: row.profiles?.verified_uc_email ?? false,
    avatar: row.profiles?.avatar_initials ?? "UC",
    description: row.description,
    location: row.location,
    due: formatDueDate(row.due_date),
    tone: row.school === "UCB" ? "blue" : row.school === "UCSD" ? "teal" : "gold",
  };
}

function mapApplicationRow(row: ApplicationRow): AppliedTask | null {
  if (!row.tasks) return null;

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    task: {
      title: row.tasks.title,
      school: row.tasks.school,
      mode: row.tasks.mode,
      reward: formatReward(row.tasks),
      createdAt: row.tasks.created_at,
    },
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
  const [view, setView] = useState<"home" | "publish" | "mine" | "profile">("home");
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
  const [publishDraft, setPublishDraft] = useState<PublishDraft>(() => readPublishDraft());
  const [publishMode, setPublishMode] = useState<"线上" | "线下">(publishDraft.mode ?? "线下");
  const [rewardType, setRewardType] = useState<"paid" | "mutual_help">(publishDraft.reward_type ?? "paid");

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    loadTasks();

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadApplications();
      return;
    }

    setAppliedTasks([]);
  }, [user]);

  const filtered = useMemo(() => tasks.filter((task) => {
    const schoolMatch = school === "全部 UC" || task.school === school;
    const categoryMatch = category === "全部任务" || task.category === category;
    const queryMatch = task.title.toLowerCase().includes(query.toLowerCase()) || task.category.includes(query);
    return schoolMatch && categoryMatch && queryMatch;
  }), [tasks, school, category, query]);

  const postedTasks = useMemo(() => {
    if (!user) return [];
    return tasks.filter((task) => task.authorId === user.id);
  }, [tasks, user]);

  const featuredTasks = useMemo(() => tasks.slice(0, 3), [tasks]);

  function requireAuth(action: () => void, message = "请先登录后继续") {
    if (!user) {
      flash(message);
      setShowLogin(true);
      return;
    }

    action();
  }

  async function loadTasks() {
    if (!supabase) return;
    setIsLoadingTasks(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*, profiles(display_name, avatar_initials, verified_uc_email)")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    setIsLoadingTasks(false);

    if (error) {
      flash("读取数据库失败，已显示 Demo 数据");
      return;
    }

    setTasks(((data ?? []) as TaskRow[]).map(mapTaskRow));
  }

  async function loadApplications() {
    if (!supabase || !user) return;

    const { data, error } = await supabase
      .from("applications")
      .select("*, tasks(title, school, mode, reward_amount, reward_type, created_at)")
      .eq("applicant_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      flash("读取申请记录失败");
      return;
    }

    setAppliedTasks(((data ?? []) as ApplicationRow[]).map(mapApplicationRow).filter((item): item is AppliedTask => Boolean(item)));
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function navigate(next: "home" | "publish" | "mine" | "profile") {
    setView(next);
    setSelectedTask(null);
    setPublished(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => navigate("home")} aria-label="返回首页">
            <span className="brand-mark"><i /><i /><i /></span>
            <span>UC Connect</span>
          </button>
          <nav className="desktop-nav" aria-label="主导航">
            <button className={view === "home" ? "nav-active" : ""} onClick={() => navigate("home")}>发现任务</button>
            <button className={view === "mine" ? "nav-active" : ""} onClick={() => requireAuth(() => navigate("mine"), "请先登录后查看我的任务")}>我的任务</button>
            <button onClick={() => flash("你暂时没有新消息")}>消息</button>
          </nav>
          <div className="header-actions">
            <button className="ghost-button" onClick={() => user ? flash(`已登录：${user.email}`) : setShowLogin(true)}>{user ? "已登录" : "登录"}</button>
            <button className="primary-button small" onClick={() => requireAuth(() => navigate("publish"), "请先登录后再发布需求")}>＋ 发布需求</button>
            <button className="profile-button" onClick={openProfile} aria-label="打开个人主页">{getUserInitials(user)}</button>
          </div>
        </div>
      </header>

      {view === "home" && (!selectedTask ? (
        <>
          <section className="hero">
            <div className="hero-grid">
              <div className="hero-copy">
                <span className="eyebrow"><span className="pulse" /> UCB · UCSD · UCLA 首发</span>
                <h1>让每一个需求，<br /><em>找到对的人回应。</em></h1>
                <p>连接 UC 校园里的同学，发布需求、分享经验、互相帮忙。简单一点，真诚一点。</p>
                <div className="hero-actions">
                  <button className="primary-button" onClick={() => document.getElementById("task-list")?.scrollIntoView({ behavior: "smooth" })}>浏览附近任务 <span>→</span></button>
                  <button className="text-button" onClick={() => requireAuth(() => navigate("publish"), "请先登录后再发布需求")}>我有一个需求</button>
                </div>
                <div className="trust-row">
                  <span className="avatar-stack"><i>MC</i><i>EL</i><i>SW</i></span>
                  <span><strong>MVP 测试版</strong><br />真实发布内容会同步到数据库</span>
                </div>
              </div>
              <div className="hero-board" aria-label="热门任务预览">
                <div className="board-top"><span>最新任务</span><span className="live-dot">数据库同步</span></div>
                {(featuredTasks.length ? featuredTasks : demoTasks.slice(0, 3)).map((task) => (
                  <button className="feature-task" key={task.id} onClick={() => setSelectedTask(task)}>
                    <div className={`task-icon ${task.tone}`}>{task.mode === "线上" ? "◎" : "⌁"}</div>
                    <div><span className="mini-label">{task.school} · {task.category}</span><h3>{task.title}</h3><p>{task.time} · {task.applicants} 人申请</p></div>
                    <strong className={task.reward.includes("互助") ? "free" : ""}>{task.reward}</strong>
                  </button>
                ))}
                <div className="board-footer"><span>真实发布 · 学校认证 · 申请记录</span><span>♡</span></div>
              </div>
            </div>
          </section>

          <section className="task-section" id="task-list">
            <div className="section-heading">
              <div><span className="section-kicker">EXPLORE</span><h2>发现正在发生的需求</h2></div>
              <div className="school-tabs">
                {["全部 UC", "UCB", "UCSD", "UCLA"].map((item) => <button key={item} className={school === item ? "active" : ""} onClick={() => setSchool(item)}>{item}</button>)}
              </div>
            </div>
            <div className="filter-row">
              <div className="category-tabs">
                {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              <label className="search-box"><span>⌕</span><input aria-label="搜索任务" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务" /></label>
            </div>
            <div className="task-grid">
              {isLoadingTasks && <div className="empty-state"><span>⌕</span><h3>正在读取任务</h3><p>连接 Supabase 数据库中。</p></div>}
              {filtered.map((task) => (
                <button className="task-card" key={task.id} onClick={() => { setSelectedTask(task); window.scrollTo(0, 0); }}>
                  <div className="card-meta"><span className={`school-badge ${task.school.toLowerCase()}`}>{task.school}</span><span>{task.time}</span></div>
                  <h3>{task.title}</h3>
                  <p className="task-desc">{task.description}</p>
                  <div className="task-tags"><span>{task.category}</span><span>{task.mode}</span></div>
                  <div className="card-footer">
                    <span className="user-chip"><i>{task.avatar}</i><span>{task.author}{task.verified && <b title="学校邮箱已认证">✓</b>}</span></span>
                    <span className="reward">{task.reward}</span>
                  </div>
                  <div className="applicant-line"><span>{task.applicants} 人已申请</span><span>查看详情 →</span></div>
                </button>
              ))}
              {filtered.length === 0 && <div className="empty-state"><span>⌕</span><h3>暂时没有匹配的任务</h3><p>换个学校或关键词试试。</p></div>}
            </div>
          </section>

          <section className="how-it-works">
            <span className="section-kicker">HOW IT WORKS</span><h2>三步，找到你的校园连接</h2>
            <div className="step-grid">
              <div><b>01</b><span className="step-icon">＋</span><h3>发布一个需求</h3><p>说清楚你需要什么、时间和地点。</p></div>
              <div><b>02</b><span className="step-icon">⌁</span><h3>选择合适的同学</h3><p>查看申请说明和学校认证信息。</p></div>
              <div><b>03</b><span className="step-icon">✓</span><h3>完成并互相评价</h3><p>确认完成，给认真帮助的人一点认可。</p></div>
            </div>
          </section>
        </>
      ) : (
        <section className="detail-page">
          <button className="back-button" onClick={() => { setSelectedTask(null); setShowApply(false); setApplied(false); }}>← 返回任务列表</button>
          <div className="detail-layout">
            <article className="detail-main">
              <div className="detail-meta"><span className={`school-badge ${selectedTask.school.toLowerCase()}`}>{selectedTask.school}</span><span>{selectedTask.category}</span><span>·</span><span>{selectedTask.time}</span></div>
              <h1>{selectedTask.title}</h1>
              <div className="detail-author"><i>{selectedTask.avatar}</i><span><strong>{selectedTask.author} {selectedTask.verified && <b>✓ 已认证</b>}</strong><small>MVP 用户资料 · 评价功能待上线</small></span></div>
              <div className="detail-facts">
                <div><span>地点</span><strong>{selectedTask.location}</strong></div>
                <div><span>希望完成</span><strong>{selectedTask.due}</strong></div>
                <div><span>任务形式</span><strong>{selectedTask.mode}</strong></div>
              </div>
              <div className="detail-copy"><h2>需求说明</h2><p>{selectedTask.description}</p><p>申请时可以简单介绍你的时间安排。如果有相关经验，也请一起说明。</p></div>
              <div className="safety-note"><span>◇</span><div><strong>安全提醒</strong><p>请勿提前转账或分享敏感个人信息。接受申请后再交换联系方式。</p></div></div>
            </article>
            <aside className="apply-card">
              <span>任务报酬</span><strong>{selectedTask.reward}</strong><small>平台 Demo 不处理真实付款</small>
              <hr />
              <div className="apply-stat"><span>已有申请</span><b>{selectedTask.applicants} 人</b></div>
              {!showApply && !applied && <button className="primary-button wide" onClick={() => requireAuth(() => setShowApply(true), "请先登录后再申请任务")}>申请接取</button>}
              {showApply && !applied && <form onSubmit={handleApply} className="apply-form">
                <label>申请说明<textarea required name="message" placeholder="介绍一下你为什么适合，以及可以完成的时间…" /></label>
                <label>可完成时间<input required name="available_time" placeholder="例如：周三下午" /></label>
                <button className="primary-button wide" type="submit">提交申请</button>
                <button className="text-button wide" type="button" onClick={() => setShowApply(false)}>取消</button>
              </form>}
              {applied && <div className="success-box"><span>✓</span><strong>申请已提交</strong><p>发布者选择后会通知你。</p></div>}
              <button className="report-button" onClick={() => flash("已打开举报入口（Demo）")}>⚑ 举报此任务</button>
            </aside>
          </div>
        </section>
      ))}

      {view === "publish" && (
        <section className="app-page publish-page">
          <div className="page-intro">
            <button className="back-button" onClick={() => navigate("home")}>← 返回发现</button>
            <span className="section-kicker">NEW REQUEST</span>
            <h1>发布一个需求</h1>
            <p>描述得越清楚，越容易找到合适的同学。</p>
          </div>
          {!published ? (
            <form className="publish-form" onSubmit={handlePublish}>
              <div className="form-section">
                <span className="form-step">01</span><div><h2>基本信息</h2><p>先让大家一眼看懂你需要什么。</p></div>
                <div className="form-fields full-row">
                  <label className="field-wide">需求标题<input required name="title" defaultValue={publishDraft.title ?? ""} placeholder="例如：帮忙实拍宿舍公共区域" /></label>
                  <label>任务类别<select required name="category" defaultValue={publishDraft.category ?? ""}><option value="" disabled>请选择</option><option>校园实拍</option><option>新生落地</option><option>经验咨询</option><option>校园互助</option><option>校园信息</option></select></label>
                  <label>所属学校<select required name="school" defaultValue={publishDraft.school ?? "UCB"}><option>UCB</option><option>UCSD</option><option>UCLA</option></select></label>
                  <label className="field-wide">详细说明<textarea required name="description" defaultValue={publishDraft.description ?? ""} placeholder="具体需要做什么？有没有特别需要注意的地方？" /></label>
                </div>
              </div>
              <div className="form-section">
                <span className="form-step">02</span><div><h2>时间与地点</h2><p>告诉申请者在哪里、什么时候完成。</p></div>
                <div className="form-fields full-row">
                  <label>任务形式<select name="mode" value={publishMode} onChange={(event) => setPublishMode(event.target.value as "线上" | "线下")}><option>线下</option><option>线上</option></select></label>
                  <label>任务范围<select><option>本校学生</option><option>所有 UC 学生</option></select></label>
                  <label>{publishMode === "线上" ? "线上方式" : "地点"}<input required={publishMode === "线下"} name="location" defaultValue={publishDraft.location ?? ""} placeholder={publishMode === "线上" ? "例如：Zoom / 微信语音，可留空" : "例如：Blackwell Hall"} /></label>
                  <label>希望完成时间<input required name="due_date" type="date" defaultValue={publishDraft.due_date ?? "2026-08-08"} /></label>
                </div>
              </div>
              <div className="form-section">
                <span className="form-step">03</span><div><h2>报酬说明</h2><p>MVP 暂不处理真实付款。</p></div>
                <div className="form-fields full-row">
                  <label>需求类型<select name="reward_type" value={rewardType} onChange={(event) => setRewardType(event.target.value as "paid" | "mutual_help")}><option value="paid">有偿任务</option><option value="mutual_help">免费互助</option></select></label>
                  <label>报酬金额<div className="money-input"><span>$</span><input disabled={rewardType === "mutual_help"} required={rewardType === "paid"} name="reward_amount" type="number" min="0" defaultValue={publishDraft.reward_amount ?? ""} placeholder={rewardType === "paid" ? "25" : "免费互助无需填写"} /></div></label>
                </div>
              </div>
              <label className="agreement"><input required type="checkbox" /> 我确认该需求不涉及代写、代考、换汇、违法服务或其他平台禁止内容。</label>
              <div className="form-actions"><button type="button" className="ghost-outline" onClick={(event) => saveDraft(event.currentTarget.form)}>保存草稿</button><button className="primary-button" type="submit">发布需求 →</button></div>
            </form>
          ) : (
            <div className="publish-success"><span>✓</span><h2>需求已发布</h2><p>你的任务现在会出现在对应校园的任务流中。</p><div className="preview-ticket"><span className={`school-badge ${(lastPublishedTask?.school ?? "UCB").toLowerCase()}`}>{lastPublishedTask?.school ?? "UCB"}</span><h3>{lastPublishedTask?.title ?? "新的校园需求"}</h3><small>刚刚 · 等待第一位申请者</small></div><button className="primary-button" onClick={() => navigate("mine")}>前往我的任务</button><button className="text-button" onClick={() => navigate("home")}>返回首页</button></div>
          )}
        </section>
      )}

      {view === "mine" && (
        <section className="app-page mine-page">
          <div className="page-intro compact"><span className="section-kicker">MY TASKS</span><h1>我的任务</h1><p>在这里跟进你发布和申请的所有需求。</p></div>
          <div className="mine-tabs"><button className={mineTab === "posted" ? "active" : ""} onClick={() => setMineTab("posted")}>我发布的 <b>{postedTasks.length}</b></button><button className={mineTab === "applied" ? "active" : ""} onClick={() => setMineTab("applied")}>我申请的 <b>{appliedTasks.length}</b></button></div>
          {mineTab === "posted" ? (
            <div className="dashboard-layout">
              <div className="status-cards"><div><span>招募中</span><strong>{postedTasks.length}</strong><small>共 {postedTasks.reduce((sum, task) => sum + task.applicants, 0)} 份申请</small></div><div><span>进行中</span><strong>0</strong><small>等待双方完成</small></div><div><span>本月完成</span><strong>0</strong><small>MVP 数据开始记录</small></div></div>
              <div className="task-table">
                <div className="table-title"><h2>最近发布</h2><button onClick={() => navigate("publish")}>＋ 新需求</button></div>
                {postedTasks.map((task) => (
                  <div className="task-row" key={task.id}><span className="status open">招募中</span><div><strong>{task.title}</strong><small>{task.school} · {task.category} · {task.applicants} 份申请</small></div><b>{task.reward}</b><button onClick={() => { navigate("home"); setSelectedTask(task); }}>查看 →</button></div>
                ))}
                {postedTasks.length === 0 && <div className="empty-state"><span>＋</span><h3>还没有发布任务</h3><p>发布第一个需求后，会显示在这里。</p></div>}
              </div>
            </div>
          ) : (
            <div className="task-table applied-table">
              <div className="table-title"><h2>申请记录</h2><span>状态有变化时会收到提醒</span></div>
              {appliedTasks.map((application) => (
                <div className="task-row" key={application.id}><span className={`status ${application.status === "pending" ? "waiting" : "progress"}`}>{formatApplicationStatus(application.status)}</span><div><strong>{application.task.title}</strong><small>{application.task.school} · {application.task.mode} · 申请于 {formatRelativeTime(application.createdAt)}</small></div><b>{application.task.reward}</b><button onClick={() => flash("申请详情页待上线")}>查看 →</button></div>
              ))}
              {appliedTasks.length === 0 && <div className="empty-state"><span>⌕</span><h3>还没有申请记录</h3><p>申请任务后，会显示在这里。</p></div>}
            </div>
          )}
        </section>
      )}

      {view === "profile" && (
        <section className="app-page profile-page">
          <div className="profile-hero"><div className="profile-avatar">{getUserInitials(user)}</div><div><span className="verified-pill">✓ 已登录</span><h1>{getUserName(user)}</h1><p>{getUserSchool(user)} · {user?.email}</p></div><button className="ghost-outline" onClick={signOut}>退出登录</button></div>
          <div className="profile-layout">
            <aside className="profile-sidebar"><h3>个人简介</h3><p>这里会显示当前登录用户的个人资料。MVP 阶段先根据邮箱自动生成基础信息。</p><dl><div><dt>账号邮箱</dt><dd>{user?.email}</dd></div><div><dt>常用语言</dt><dd>中文 · English</dd></div><div><dt>所在校区</dt><dd>{getUserSchool(user)}</dd></div></dl></aside>
            <div className="profile-content"><div className="profile-stats"><div><strong>{postedTasks.length}</strong><span>发布任务</span></div><div><strong>{appliedTasks.length}</strong><span>申请任务</span></div><div><strong>0</strong><span>完成任务</span></div></div><div className="reviews"><div className="table-title"><h2>收到的评价</h2><span>待上线</span></div><div className="empty-state"><span>☆</span><h3>评价功能待上线</h3><p>完成任务后，这里会展示真实评价。</p></div></div></div>
          </div>
        </section>
      )}

      <nav className="mobile-nav" aria-label="移动端导航"><button className={view === "home" ? "active" : ""} onClick={() => navigate("home")}><span>⌕</span>发现</button><button className={view === "mine" ? "active" : ""} onClick={() => requireAuth(() => navigate("mine"), "请先登录后查看我的任务")}><span>▤</span>任务</button><button className="mobile-add" onClick={() => requireAuth(() => navigate("publish"), "请先登录后再发布需求")}>＋</button><button onClick={() => flash("你暂时没有新消息")}><span>◇</span>消息</button><button className={view === "profile" ? "active" : ""} onClick={openProfile}><span>○</span>我的</button></nav>

      <footer><div className="footer-inner"><span className="brand footer-brand"><span className="brand-mark"><i /><i /><i /></span><span>UC Connect</span></span><p>连接每一个 UC 校园，让需求找到回应。</p><span>Demo v0.1 · 2026</span></div></footer>
      {notice && <div className="toast">{notice}</div>}
      {showLogin && <div className="modal-backdrop" onMouseDown={() => setShowLogin(false)}><section className="login-modal" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowLogin(false)}>×</button><span className="brand-mark login-logo"><i /><i /><i /></span><h2>欢迎来到 UC Connect</h2><p>登录后即可发布需求、提交申请和管理任务。</p><button className="sso-button" onClick={() => flash("Google 登录可以下一步接入")}>G&nbsp;&nbsp; 使用 Google 登录</button><div className="or"><span />或<span /></div><form onSubmit={signInWithPassword}><label>邮箱地址<input required name="email" placeholder="name@berkeley.edu" type="email" /></label><label>密码<input required name="password" minLength={6} placeholder="至少 6 位密码" type="password" /></label><button className="primary-button wide" type="submit">登录 / 注册</button></form><small>新邮箱会自动创建账号。使用学校邮箱可获得 UC 认证标志。</small></section></div>}
    </main>
  );
}
