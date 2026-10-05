export const DEFAULT_PERIODS = [
  { id: "1-2", start: "08:00", end: "09:45" },
  { id: "3-4", start: "10:10", end: "11:50" },
  { id: "5-6", start: "14:00", end: "15:40" },
  { id: "7-8", start: "16:10", end: "17:50" },
  { id: "9-10", start: "19:00", end: "20:40" },
  { id: "11-12", start: "20:50", end: "22:20" },
];

export const WEEKDAY_NAMES = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const FIELD_ALIASES = {
  title: ["课程名称", "课程名", "课程", "科目", "名称", "subject", "course", "coursename", "name", "title"],
  teacher: ["任课教师", "教师姓名", "教师", "老师", "teacher", "instructor", "lecturer"],
  room: ["上课地点", "教室", "地点", "场地", "位置", "room", "location", "classroom"],
  weekday: ["星期", "星期几", "周几", "上课日", "weekday", "day", "dayofweek"],
  period: ["节次", "上课节次", "时间段", "课节", "period", "periods", "section", "sections"],
  weeks: ["周次", "教学周", "上课周次", "周数", "weeks", "week", "weekrange"],
  startTime: ["开始时间", "上课时间", "开始", "starttime", "start"],
  endTime: ["结束时间", "下课时间", "结束", "endtime", "end"],
  date: ["日期", "上课日期", "date", "classdate"],
  notes: ["备注", "说明", "note", "notes", "description"],
};

const normalizeHeader = (value) => String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/[\s_\-（）()【】\[\]：:]/g, "");

const aliasLookup = new Map(
  Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) => aliases.map((alias) => [normalizeHeader(alias), field])),
);

export function normalizeWeekday(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value >= 1 && value <= 7 ? value : null;
  const raw = String(value).trim().toLowerCase();
  if (/^[1-7]$/.test(raw)) return Number(raw);
  const compact = raw.replace(/星期|礼拜|周|曜|day|\s/g, "");
  const names = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7 };
  return names[compact] ?? names[raw] ?? null;
}

export function normalizePeriod(value) {
  if (Array.isArray(value)) value = value.join("-");
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const numbers = raw.match(/\d+/g)?.map(Number) ?? [];
  if (!numbers.length) return raw;
  if (numbers.length === 1) return String(numbers[0]);
  return `${Math.min(...numbers)}-${Math.max(...numbers)}`;
}

export function parseWeeks(value, defaultWeeks = []) {
  if (Array.isArray(value)) {
    const weeks = value.flatMap((item) => parseWeeks(item));
    return [...new Set(weeks)].filter((week) => week > 0 && week <= 60).sort((a, b) => a - b);
  }
  if (typeof value === "number") return value > 0 ? [value] : [];
  const raw = String(value ?? "").trim();
  if (!raw) return [...defaultWeeks];
  const oddOnly = /单周|单数周|\(单\)|（单）|\bodd\b/i.test(raw);
  const evenOnly = /双周|偶数周|\(双\)|（双）|\beven\b/i.test(raw);
  const cleaned = raw
    .replace(/第|周次|周|教学|单周|双周|单数周|偶数周|\(单\)|（单）|\(双\)|（双）/g, "")
    .replace(/[，、；;]/g, ",")
    .replace(/[—–~～至]/g, "-");
  const result = [];
  for (const part of cleaned.split(/[,\s]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let week = Math.min(start, end); week <= Math.max(start, end); week += 1) result.push(week);
    } else if (/^\d+$/.test(part)) {
      result.push(Number(part));
    }
  }
  return [...new Set(result)]
    .filter((week) => week > 0 && week <= 60)
    .filter((week) => !oddOnly || week % 2 === 1)
    .filter((week) => !evenOnly || week % 2 === 0)
    .sort((a, b) => a - b);
}

export function formatWeeks(weeks) {
  const sorted = [...new Set((weeks ?? []).map(Number).filter(Boolean))].sort((a, b) => a - b);
  if (!sorted.length) return "";
  const parts = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    parts.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = current;
    previous = current;
  }
  return `${parts.join(",")}周`;
}

function pick(source, field) {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (aliasLookup.get(normalizeHeader(key)) === field && value != null && value !== "") return value;
  }
  return undefined;
}

function cleanTime(value) {
  if (value instanceof Date) return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  const match = String(value ?? "").match(/(\d{1,2})[:：](\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : "";
}

function cleanDate(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return dateKey(value);
  const match = String(value ?? "").match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : "";
}

export function normalizeCourse(source, index = 0) {
  const title = pick(source, "title") ?? source.title ?? source.name ?? source.courseName ?? "";
  const date = cleanDate(pick(source, "date") ?? source.date);
  const weekday = normalizeWeekday(pick(source, "weekday") ?? source.weekday ?? (date ? isoWeekday(parseDate(date)) : null));
  const wakeUpPeriod = source.startNode != null
    ? `${source.startNode}${source.endNode != null && source.endNode !== source.startNode ? `-${source.endNode}` : ""}`
    : "";
  let weeks = parseWeeks(pick(source, "weeks") ?? source.weeks ?? source.week ?? []);
  if (!weeks.length && source.startWeek != null) {
    const endWeek = Number(source.endWeek ?? source.startWeek);
    weeks = parseWeeks(`${source.startWeek}-${endWeek}周`);
    if (Number(source.type) === 1) weeks = weeks.filter((week) => week % 2 === 1);
    if (Number(source.type) === 2) weeks = weeks.filter((week) => week % 2 === 0);
  }
  return {
    id: source.id ?? `course-${Date.now().toString(36)}-${index}`,
    title: String(title).trim(),
    teacher: String(pick(source, "teacher") ?? source.teacher ?? "").trim(),
    room: String(pick(source, "room") ?? source.room ?? source.location ?? "").trim(),
    weekday,
    period: normalizePeriod(pick(source, "period") ?? source.period ?? source.sections ?? wakeUpPeriod),
    weeks,
    startTime: cleanTime(pick(source, "startTime") ?? source.startTime),
    endTime: cleanTime(pick(source, "endTime") ?? source.endTime),
    dates: [...new Set([...(source.dates ?? []), ...(date ? [date] : [])])].filter(Boolean).sort(),
    notes: String(pick(source, "notes") ?? source.notes ?? source.description ?? "").trim(),
    source: source.source ?? "imported",
  };
}

function scoreHeaderRow(row) {
  return row.reduce((score, cell) => score + (aliasLookup.has(normalizeHeader(cell)) ? 1 : 0), 0);
}

export function parseTableRows(rows) {
  const usableRows = rows.map((row) => Array.isArray(row) ? row : Object.values(row));
  const candidates = usableRows.slice(0, 15).map((row, index) => ({ index, score: scoreHeaderRow(row) }));
  const header = candidates.sort((a, b) => b.score - a.score)[0];
  if (!header || header.score < 2) throw new Error("没有找到可识别的表头。请使用模板列名，或先将课表整理成课程列表。");
  const headers = usableRows[header.index].map((value) => String(value ?? "").trim());
  const courses = usableRows.slice(header.index + 1).map((row, index) => {
    const object = Object.fromEntries(headers.map((key, cellIndex) => [key || `column_${cellIndex}`, row[cellIndex]]));
    return normalizeCourse(object, index);
  }).filter((course) => course.title || course.room || course.teacher);
  if (!courses.length) throw new Error("表格中没有找到课程记录。");
  return courses;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === '"') {
      if (quoted && normalized[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (!quoted && (char === "," || char === "\t")) {
      row.push(value); value = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && normalized[index + 1] === "\n") index += 1;
      row.push(value); value = "";
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
    } else value += char;
  }
  row.push(value);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return parseTableRows(rows);
}

function findCourseArray(value, depth = 0) {
  if (depth > 5 || value == null) return null;
  if (Array.isArray(value)) {
    if (value.length && value.some((item) => item && typeof item === "object" && Object.keys(item).some((key) => aliasLookup.get(normalizeHeader(key)) === "title"))) return value;
    for (const item of value) {
      const found = findCourseArray(item, depth + 1);
      if (found) return found;
    }
  } else if (typeof value === "object") {
    for (const key of ["courses", "courseList", "courseInfos", "data", "items", "list"]) {
      const found = findCourseArray(value[key], depth + 1);
      if (found) return found;
    }
    for (const child of Object.values(value)) {
      const found = findCourseArray(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function parseJson(text) {
  const data = typeof text === "string" ? JSON.parse(text.replace(/^\uFEFF/, "")) : text;
  const array = findCourseArray(data) ?? (Array.isArray(data) ? data : null);
  if (!array) throw new Error("JSON 中没有找到课程数组。");
  const courses = array.map((item, index) => normalizeCourse(item, index)).filter((course) => course.title);
  if (!courses.length) throw new Error("JSON 中没有找到带课程名称的记录。");
  return courses;
}

export function parseHtml(text) {
  const document = new DOMParser().parseFromString(text, "text/html");
  const tables = [...document.querySelectorAll("table")];
  if (!tables.length) throw new Error("HTML 中没有找到表格。");
  const table = tables.sort((a, b) => b.querySelectorAll("tr").length - a.querySelectorAll("tr").length)[0];
  const rows = [...table.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("th,td")].map((cell) => cell.textContent.trim()));
  return parseTableRows(rows);
}

export function parseLabeledText(text) {
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n+/).filter((block) => block.trim());
  const records = blocks.map((block) => {
    const record = {};
    for (const line of block.split("\n")) {
      const match = line.match(/^\s*([^:：]{1,12})\s*[:：]\s*(.+?)\s*$/);
      if (match) record[match[1]] = match[2];
    }
    return record;
  }).filter((record) => Object.keys(record).length >= 2);
  if (records.length) return records.map((record, index) => normalizeCourse(record, index)).filter((course) => course.title);
  return parseCsv(text);
}

function unfoldIcs(text) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").replace(/\r/g, "");
}

function unescapeIcs(value = "") {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcsDate(value) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!match) return null;
  return { date: `${match[1]}-${match[2]}-${match[3]}`, time: match[4] ? `${match[4]}:${match[5]}` : "" };
}

export function parseIcs(text) {
  const events = unfoldIcs(text).split("BEGIN:VEVENT").slice(1).map((chunk) => chunk.split("END:VEVENT")[0]);
  if (!events.length) throw new Error("ICS 中没有找到日程。");
  const parsed = events.map((event, index) => {
    const fields = {};
    for (const line of event.split("\n")) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const left = line.slice(0, separator);
      const name = left.split(";")[0].toUpperCase();
      fields[name] = line.slice(separator + 1);
    }
    const start = parseIcsDate(fields.DTSTART ?? "");
    const end = parseIcsDate(fields.DTEND ?? "");
    if (!start) return null;
    const title = unescapeIcs(fields.SUMMARY ?? "").replace(/^📚\s*/, "");
    return normalizeCourse({
      id: fields.UID || `ics-${index}`,
      title,
      room: unescapeIcs(fields.LOCATION ?? ""),
      notes: unescapeIcs(fields.DESCRIPTION ?? ""),
      weekday: isoWeekday(parseDate(start.date)),
      startTime: start.time,
      endTime: end?.time ?? "",
      dates: [start.date],
      source: "ics",
    }, index);
  }).filter(Boolean);
  const grouped = new Map();
  for (const course of parsed) {
    const key = [course.title, course.room, course.startTime, course.endTime, course.weekday].join("|");
    const existing = grouped.get(key);
    if (existing) existing.dates = [...new Set([...existing.dates, ...course.dates])].sort();
    else grouped.set(key, course);
  }
  return [...grouped.values()];
}

export function detectAndParseText(text, filename = "") {
  const trimmed = text.trim();
  const extension = filename.toLowerCase().split(".").pop();
  if (/BEGIN:VCALENDAR/i.test(trimmed) || extension === "ics") return parseIcs(trimmed);
  if (/^[\[{]/.test(trimmed) || extension === "json") {
    try { return parseJson(trimmed); } catch (error) { if (extension === "json") throw error; }
  }
  if (/<(?:html|table|tr|td)[\s>]/i.test(trimmed) || ["html", "htm"].includes(extension)) return parseHtml(trimmed);
  return parseLabeledText(trimmed);
}

export function parseDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isoWeekday(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

export function datesForCourse(course, semesterStart) {
  if (course.dates?.length) return [...course.dates];
  if (!semesterStart || !course.weekday || !course.weeks?.length) return [];
  const start = parseDate(semesterStart);
  const firstMonday = addDays(start, 1 - isoWeekday(start));
  return course.weeks.map((week) => dateKey(addDays(firstMonday, ((week - 1) * 7) + course.weekday - 1)));
}

function escapeIcs(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function hash(input) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

function icsDateTime(date, time) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function foldLine(line) {
  const chunks = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const charBytes = new TextEncoder().encode(char).length;
    if (bytes + charBytes > 72 && current) { chunks.push(current); current = " "; bytes = 1; }
    current += char;
    bytes += charBytes;
  }
  chunks.push(current);
  return chunks.join("\r\n");
}

export function validateSchedule(courses, settings, periods = DEFAULT_PERIODS) {
  const issues = [];
  if (!courses.length) issues.push({ level: "error", message: "还没有课程可导出。" });
  const periodMap = new Map(periods.map((period) => [period.id, period]));
  courses.forEach((course, index) => {
    const label = course.title || `第 ${index + 1} 行`;
    if (!course.title) issues.push({ level: "error", message: `${label}缺少课程名称。` });
    if (!course.weekday && !course.dates?.length) issues.push({ level: "error", message: `${label}缺少星期。` });
    if (!course.weeks?.length && !course.dates?.length) issues.push({ level: "error", message: `${label}缺少周次。` });
    const period = periodMap.get(course.period);
    if (!(course.startTime && course.endTime) && !period) issues.push({ level: "error", message: `${label}的节次没有对应时间。` });
  });
  if (courses.some((course) => !course.dates?.length) && !settings.semesterStart) issues.push({ level: "error", message: "请填写第一教学周内的任意日期。" });
  return issues;
}

export function exportIcs(courses, settings, periods = DEFAULT_PERIODS) {
  const issues = validateSchedule(courses, settings, periods);
  if (issues.some((issue) => issue.level === "error")) throw new Error(issues[0].message);
  const periodMap = new Map(periods.map((period) => [period.id, period]));
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Course Island//Timetable Converter//ZH-CN",
    `X-WR-CALNAME:${escapeIcs(settings.calendarName || "课程岛")}`,
    `X-WR-TIMEZONE:${settings.timezone || "Asia/Shanghai"}`,
  ];
  for (const course of courses) {
    const period = periodMap.get(course.period) ?? {};
    const startTime = course.startTime || period.start;
    const endTime = course.endTime || period.end;
    for (const date of datesForCourse(course, settings.semesterStart)) {
      const uidSeed = [settings.semesterName, course.title, course.room, date, startTime, endTime].join("|");
      const description = [
        course.teacher ? `教师：${course.teacher}` : "",
        course.period ? `节次：第${course.period}节` : "",
        course.weeks?.length ? `周次：${formatWeeks(course.weeks)}` : "",
        course.notes,
      ].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${hash(uidSeed)}@course-island.local`,
        `DTSTAMP:${now}`,
        `DTSTART;TZID=${settings.timezone || "Asia/Shanghai"}:${icsDateTime(date, startTime)}`,
        `DTEND;TZID=${settings.timezone || "Asia/Shanghai"}:${icsDateTime(date, endTime)}`,
        `SUMMARY:${escapeIcs(`📚 ${course.title}`)}`,
        `LOCATION:${escapeIcs(course.room)}`,
        `DESCRIPTION:${escapeIcs(description)}`,
        "CATEGORIES:课程岛",
        `X-COURSE-IMPORTER:course-island-web`,
        `X-COURSE-ID:${hash([course.title, course.weekday, course.period].join("|"))}`,
        `X-SEMESTER-ID:${hash(settings.semesterName || settings.semesterStart)}`,
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function csvTemplate() {
  return [
    "课程名称,教师,地点,星期,节次,周次,开始时间,结束时间,备注",
    "高等数学,张老师,教学楼A201,周一,1-2,1-16周,,,",
    "大学体育,李老师,东操场,周五,5-6,1-16周（单）,,,",
  ].join("\r\n");
}

export function sampleCourses() {
  return [
    { title: "高等数学", teacher: "张老师", room: "教学楼 A201", weekday: 1, period: "1-2", weeks: parseWeeks("1-16周") },
    { title: "大学英语", teacher: "陈老师", room: "综合楼 305", weekday: 2, period: "3-4", weeks: parseWeeks("1-16周") },
    { title: "程序设计", teacher: "王老师", room: "实训楼 412", weekday: 4, period: "1-2", weeks: parseWeeks("1-16周") },
    { title: "大学体育", teacher: "李老师", room: "东操场", weekday: 5, period: "5-6", weeks: parseWeeks("1-16周（单）") },
  ].map((course, index) => normalizeCourse(course, index));
}
