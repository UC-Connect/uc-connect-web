"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  A_G_RULES,
  calculateApplicationFee,
  calculateUcGpa,
  checkAg,
  estimateStatewideIndex,
  FEE_RULES,
  GPA_RULES,
  type AgInput,
  type GradeLevel,
  type Letter,
  type SemesterGrade,
} from "@/lib/admissions/rules";
import { useLang } from "./LangProvider";

type Tool = "gpa" | "ag" | "fees";
type CourseKind = "regular" | "apib" | "uc-honors" | "school-honors";
type CourseRow = { id: number; name: string; level: GradeLevel; kind: CourseKind; first: Letter | ""; second: Letter | "" };

const TOOLS: Tool[] = ["gpa", "ag", "fees"];
const LETTERS: Letter[] = ["A", "B", "C", "D", "F"];
const STORAGE_KEYS = { rows: "uc-connect-gpa-rows", courses: "uc-connect-gpa-semester-courses", ag: "uc-connect-ag-input" };
const CAMPUSES = ["Berkeley", "Davis", "Irvine", "UCLA", "Merced", "Riverside", "San Diego", "Santa Barbara", "Santa Cruz"];

function emptyRows(): CourseRow[] {
  return Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: "", level: index < 3 ? 10 : 11, kind: "regular", first: "", second: "" }));
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Inputs simply won't persist.
  }
}

export function AdmissionsTools() {
  const { L } = useLang();
  const [tool, setTool] = useState<Tool>("gpa");

  useEffect(() => {
    function syncFromHash() {
      const fromHash = window.location.hash.slice(1) as Tool;
      if (TOOLS.includes(fromHash)) setTool(fromHash);
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectTool(next: Tool) {
    setTool(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  const labels: Record<Tool, string> = {
    gpa: L("UC GPA 计算器", "UC GPA calculator"),
    ag: L("A-G 课程检查", "A-G checker"),
    fees: L("申请费计算", "Application fees"),
  };

  return (
    <div className="adm-wrap adm-tools">
      <header className="adm-tools-head">
        <h1>{L("申请计算工具", "Admissions calculators")}</h1>
        <p>
          {L(
            "按 UC 官方公布的规则计算。所有计算都在你的浏览器里完成，成绩不会上传。结果只是估算，以 UC 正式计算为准。",
            "Built on UC's published rules. Everything runs in your browser and nothing is uploaded. Results are estimates; UC's own calculation controls."
          )}
        </p>
      </header>

      <div className="adm-tabs" role="tablist">
        {TOOLS.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tool === item} className={tool === item ? "active" : ""} onClick={() => selectTool(item)}>
            {labels[item]}
          </button>
        ))}
      </div>

      {tool === "gpa" && <GpaCalculator />}
      {tool === "ag" && <AgChecker />}
      {tool === "fees" && <FeeCalculator />}
    </div>
  );
}

function GpaCalculator() {
  const { L } = useLang();
  const [rows, setRows] = useState<CourseRow[]>(emptyRows);
  const [semesterCourses, setSemesterCourses] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRows(readStored(STORAGE_KEYS.rows, emptyRows()));
    setSemesterCourses(readStored(STORAGE_KEYS.courses, ""));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) writeStored(STORAGE_KEYS.rows, rows);
  }, [rows, loaded]);

  useEffect(() => {
    if (loaded) writeStored(STORAGE_KEYS.courses, semesterCourses);
  }, [semesterCourses, loaded]);

  function update(id: number, patch: Partial<CourseRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { id: Math.max(0, ...current.map((row) => row.id)) + 1, name: "", level: 11, kind: "regular", first: "", second: "" }]);
  }

  const grades: SemesterGrade[] = rows.flatMap((row) =>
    [row.first, row.second]
      .filter((letter): letter is Letter => letter !== "")
      .map((letter) => ({
        level: row.level,
        letter,
        honors: row.kind === "apib" || row.kind === "uc-honors" ? "uc" : row.kind === "school-honors" ? "school" : "none",
        apOrIb: row.kind === "apib",
      }))
  );
  const result = calculateUcGpa(grades);
  const courseCount = Number(semesterCourses);
  const statewide = result.resident.gpa !== null && courseCount > 0 ? estimateStatewideIndex(result.resident.gpa, courseCount) : null;
  const kinds: { value: CourseKind; label: string }[] = [
    { value: "regular", label: L("普通课程", "Regular") },
    { value: "apib", label: L("AP / IB HL", "AP / IB HL") },
    { value: "uc-honors", label: L("其他 UC 认可荣誉课", "Other UC-certified honors") },
    { value: "school-honors", label: L("学校自设荣誉课", "School-only honors") },
  ];
  const format = (value: number | null) => (value === null ? "—" : value.toFixed(2));
  const rowLabel = (label: string) => L(label.replace(" or above", " 及以上"), label);

  return (
    <div className="adm-tool-grid">
      <section className="adm-tool-card">
        <h2>{L("填写 10–11 年级的 A-G 课程", "Enter your 10th- and 11th-grade A-G courses")}</h2>
        <p className="adm-tool-hint">
          {L(
            "每门课填两个学期的字母成绩（一学期课只填一个）。9 年级后和 10 年级后的暑期课算作 10 年级，11 年级后的暑期课算作 11 年级。9 年级、12 年级和 P/NP 成绩不计入。",
            "Enter a letter grade for each semester (one for a semester course). Summer after 9th and 10th grade counts as 10th grade; summer after 11th counts as 11th. 9th, 12th, and Pass/No Pass grades are excluded."
          )}
        </p>
        <div className="adm-course-table" role="table">
          <div className="adm-course-row head" role="row">
            <span>{L("课程", "Course")}</span>
            <span>{L("年级", "Grade")}</span>
            <span>{L("类型", "Type")}</span>
            <span>{L("第一学期", "Sem 1")}</span>
            <span>{L("第二学期", "Sem 2")}</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.id} className="adm-course-row" role="row">
              <input aria-label={L("课程名称", "Course name")} placeholder={L("例如 AP Biology", "e.g. AP Biology")} value={row.name} onChange={(event) => update(row.id, { name: event.target.value })} />
              <select aria-label={L("年级", "Grade level")} value={row.level} onChange={(event) => update(row.id, { level: Number(event.target.value) as GradeLevel })}>
                <option value={10}>10</option>
                <option value={11}>11</option>
              </select>
              <select aria-label={L("课程类型", "Course type")} value={row.kind} onChange={(event) => update(row.id, { kind: event.target.value as CourseKind })}>
                {kinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
              </select>
              {(["first", "second"] as const).map((semester) => (
                <select key={semester} aria-label={semester === "first" ? L("第一学期成绩", "Semester 1 grade") : L("第二学期成绩", "Semester 2 grade")} value={row[semester]} onChange={(event) => update(row.id, { [semester]: event.target.value as Letter | "" })}>
                  <option value="">—</option>
                  {LETTERS.map((letter) => <option key={letter} value={letter}>{letter}</option>)}
                </select>
              ))}
              <button type="button" className="adm-icon-button" aria-label={L("删除这一行", "Remove row")} onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>×</button>
            </div>
          ))}
        </div>
        <div className="adm-tool-actions">
          <button type="button" className="adm-link-button" onClick={addRow}>＋ {L("添加课程", "Add course")}</button>
          <button type="button" className="adm-link-button muted" onClick={() => setRows(emptyRows())}>{L("清空", "Clear")}</button>
        </div>
      </section>

      <aside className="adm-tool-result">
        <div className="adm-result-main">
          <span>{L("UC GPA（加州居民，含封顶加分）", "UC GPA (CA resident, capped weighted)")}</span>
          <strong>{format(result.resident.gpa)}</strong>
        </div>
        <dl className="adm-result-list">
          <div><dt>{L("不加权 GPA", "Unweighted")}</dt><dd>{format(result.unweighted)}</dd></div>
          <div><dt>{L("外州学生 GPA（只有 AP/IB 加分）", "Nonresident GPA (AP/IB weighted only)")}</dt><dd>{format(result.nonresident.gpa)}</dd></div>
          <div><dt>{L("已用荣誉加分", "Honors points used")}</dt><dd>{result.resident.honorsPoints} / {GPA_RULES.honorsCapTotal}{L(`（10 年级 ${result.resident.tenthGradeHonors} / ${GPA_RULES.honorsCapTenthGrade}）`, ` (10th: ${result.resident.tenthGradeHonors} / ${GPA_RULES.honorsCapTenthGrade})`)}</dd></div>
          <div><dt>{L("计入的学期成绩", "Semester grades counted")}</dt><dd>{result.letterGrades}</dd></div>
        </dl>
        {result.resident.gpa !== null && (
          <p className="adm-result-note">
            {result.resident.gpa >= GPA_RULES.residentMinimum
              ? L(`达到加州居民最低要求 ${GPA_RULES.residentMinimum.toFixed(1)}。`, `Meets the ${GPA_RULES.residentMinimum.toFixed(1)} resident minimum.`)
              : L(`低于加州居民最低要求 ${GPA_RULES.residentMinimum.toFixed(1)}。`, `Below the ${GPA_RULES.residentMinimum.toFixed(1)} resident minimum.`)}{" "}
            {L("最低要求不代表有竞争力。", "A minimum is not a competitive GPA.")}
          </p>
        )}

        <div className="adm-result-section">
          <h3>{L("加州前 9% 估算（全州保底）", "Statewide top 9% estimate")}</h3>
          <label className="adm-field">
            <span>{L("A-G 学期课程总数（9–12 年级，含在读和计划中的）", "A-G semester courses (grades 9–12, including in progress and planned)")}</span>
            <input type="number" min={0} max={120} inputMode="numeric" value={semesterCourses} onChange={(event) => setSemesterCourses(event.target.value)} />
          </label>
          <p className="adm-result-note">
            {!statewide
              ? L("填写 GPA 课程和学期课程数后显示。全年课程算 2 门。", "Enter your courses and the semester course count. A yearlong course counts as 2.")
              : statewide.status === "below-chart"
                ? L("UC 的对照表从 GPA 3.60 开始，这个 GPA 不在表内。", "UC's chart starts at a 3.60 GPA; this GPA is below it.")
                : statewide.status === "meets"
                  ? L(`按 UC 对照表，GPA ${rowLabel(statewide.row.label)} 需要至少 ${statewide.row.courses} 门，你达到了。`, `For GPA ${statewide.row.label}, UC's chart needs ${statewide.row.courses} courses; you meet it.`)
                  : L(`按 UC 对照表，GPA ${rowLabel(statewide.row.label)} 需要至少 ${statewide.row.courses} 门，还差 ${statewide.shortBy} 门。`, `For GPA ${statewide.row.label}, UC's chart needs ${statewide.row.courses} courses; you are ${statewide.shortBy} short.`)}{" "}
            {L("这只是 UC 提供的自查估算，不是保证。", "This is UC's self-check estimate, not a guarantee.")}
          </p>
        </div>
        <p className="adm-result-foot">
          {L("规则来源：", "Rules from: ")}
          <Link href="/admissions/freshman-gpa-calculation">{L("UC GPA 怎么算", "UC GPA calculation")}</Link> ·{" "}
          <Link href="/admissions/statewide-and-elc-guarantee">{L("加州前 9% 保底录取", "Statewide guarantee")}</Link>
        </p>
      </aside>
    </div>
  );
}

function AgChecker() {
  const { L, pick } = useLang();
  const [input, setInput] = useState<AgInput>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setInput(readStored(STORAGE_KEYS.ag, {}));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) writeStored(STORAGE_KEYS.ag, input);
  }, [input, loaded]);

  function update(key: string, field: "beforeSenior" | "senior", value: string) {
    const years = Math.max(0, Math.min(8, Number(value) || 0));
    setInput((current) => ({ ...current, [key]: { ...(current[key] ?? { beforeSenior: 0, senior: 0 }), [field]: years } }));
  }

  const result = checkAg(input);

  return (
    <div className="adm-tool-grid">
      <section className="adm-tool-card">
        <h2>{L("每科修了几年（一门全年课算 1 年）", "Years per subject (one yearlong course = 1 year)")}</h2>
        <p className="adm-tool-hint">
          {L(
            "只算学校 UC 认可 A-G 清单上的课程，成绩须为 C 或以上。数学和外语在 7–8 年级修的课，学校认可的话也可以算。",
            "Count only courses on your school's UC-approved A-G list with a C or better. Math and language taken in 7th–8th grade count if your school accepts them."
          )}
        </p>
        <div className="adm-ag-table" role="table">
          <div className="adm-ag-row head" role="row">
            <span>{L("科目", "Subject")}</span>
            <span>{L("要求", "Required")}</span>
            <span>{L("12 年级前", "Before 12th")}</span>
            <span>{L("12 年级", "12th grade")}</span>
            <span>{L("状态", "Status")}</span>
          </div>
          {result.subjects.map((subject) => (
            <div key={subject.key} className="adm-ag-row" role="row">
              <span>{pick(subject.name)}</span>
              <span>
                {L(`${subject.required} 年`, `${subject.required} yr`)}
                {subject.recommended > subject.required && <small>{L(`（建议 ${subject.recommended}）`, ` (rec. ${subject.recommended})`)}</small>}
              </span>
              <input type="number" min={0} max={8} inputMode="numeric" aria-label={`${pick(subject.name)} ${L("12 年级前", "before 12th")}`} value={input[subject.key]?.beforeSenior ?? ""} onChange={(event) => update(subject.key, "beforeSenior", event.target.value)} />
              <input type="number" min={0} max={8} inputMode="numeric" aria-label={`${pick(subject.name)} ${L("12 年级", "12th grade")}`} value={input[subject.key]?.senior ?? ""} onChange={(event) => update(subject.key, "senior", event.target.value)} />
              <span className={subject.met ? "adm-ok" : "adm-miss"}>{subject.met ? L("✓ 满足", "✓ Met") : L("✗ 未满足", "✗ Not met")}</span>
            </div>
          ))}
        </div>
      </section>

      <aside className="adm-tool-result">
        <div className="adm-result-main">
          <span>{L("A-G 总体情况", "A-G overall")}</span>
          <strong className={result.allMet ? "ok" : ""}>{result.allMet ? L("全部满足", "All met") : L("尚未满足", "Not yet")}</strong>
        </div>
        <dl className="adm-result-list">
          <div><dt>{L("课程总数", "Total courses")}</dt><dd className={result.totalMet ? "adm-ok" : "adm-miss"}>{result.totalYears} / {A_G_RULES.totalCourses}</dd></div>
          <div><dt>{L("12 年级前完成", "Done before 12th grade")}</dt><dd className={result.beforeSeniorMet ? "adm-ok" : "adm-miss"}>{result.beforeSeniorYears} / {A_G_RULES.beforeSeniorYear}</dd></div>
        </dl>
        <p className="adm-result-note">
          {L("满足 A-G 只是最低要求之一，还需要达到最低 GPA；满足最低要求也不保证录取。", "A-G is one minimum requirement alongside the minimum GPA, and meeting minimums does not guarantee admission.")}
        </p>
        <p className="adm-result-foot">
          {L("规则来源：", "Rules from: ")}<Link href="/admissions/a-g-subject-requirements">{L("A-G 课程要求", "A-G requirements")}</Link>
        </p>
      </aside>
    </div>
  );
}

function FeeCalculator() {
  const { L } = useLang();
  const [selected, setSelected] = useState<string[]>([]);
  const [international, setInternational] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const result = calculateApplicationFee(selected.length, { international, waiverEligible: waiver && !international });

  function toggle(campus: string) {
    setSelected((current) => (current.includes(campus) ? current.filter((item) => item !== campus) : [...current, campus]));
  }

  return (
    <div className="adm-tool-grid">
      <section className="adm-tool-card">
        <h2>{L("选择要申请的校区", "Choose campuses")}</h2>
        <div className="adm-campus-grid">
          {CAMPUSES.map((campus) => (
            <label key={campus} className={selected.includes(campus) ? "active" : ""}>
              <input type="checkbox" checked={selected.includes(campus)} onChange={() => toggle(campus)} />
              {campus === "UCLA" ? "UCLA" : `UC ${campus}`}
            </label>
          ))}
        </div>
        <div className="adm-toggles">
          <label>
            <input type="checkbox" checked={international} onChange={(event) => setInternational(event.target.checked)} />
            {L("我是国际生或非移民签证申请人", "I'm an international or non-immigrant applicant")}
          </label>
          <label className={international ? "disabled" : ""}>
            <input type="checkbox" checked={waiver && !international} disabled={international} onChange={(event) => setWaiver(event.target.checked)} />
            {L("申请系统显示我符合免申请费条件", "The application shows I qualify for a fee waiver")}
          </label>
        </div>
        <p className="adm-tool-hint">
          {L(
            "免申请费只适用于美国公民、永久居民和符合 AB 540 条件的申请人。在申请系统 About you 部分填写家庭人数和收入后，选校区时会显示能免几个。",
            "Fee waivers are for U.S. citizens, permanent residents, and AB 540-eligible applicants. After you enter family size and income in About you, the application shows how many campuses are free."
          )}
        </p>
      </section>

      <aside className="adm-tool-result">
        <div className="adm-result-main">
          <span>{L("预计申请费", "Estimated fee")}</span>
          <strong>${result.total}</strong>
        </div>
        <dl className="adm-result-list">
          <div><dt>{L("校区数量", "Campuses")}</dt><dd>{result.campuses}</dd></div>
          <div><dt>{L("每个校区", "Per campus")}</dt><dd>${result.perCampus}</dd></div>
          <div><dt>{L("免除的校区", "Waived campuses")}</dt><dd>{result.waived} / {FEE_RULES.waiverCampuses}</dd></div>
        </dl>
        <p className="adm-result-note">{L("申请费提交后不退，取消申请也要付。", "Fees are non-refundable, even if you cancel.")}</p>
        <p className="adm-result-foot">
          {L("规则来源：", "Rules from: ")}<Link href="/admissions/application-fees-and-waivers">{L("申请费与免申请费", "Fees and waivers")}</Link>
        </p>
      </aside>
    </div>
  );
}
