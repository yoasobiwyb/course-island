import readXlsxFile from "read-excel-file/browser";
import "./styles.css";
import {
  DEFAULT_PERIODS,
  WEEKDAY_NAMES,
  csvTemplate,
  detectAndParseText,
  exportIcs,
  formatWeeks,
  normalizeCourse,
  parseTableRows,
  parseWeeks,
  sampleCourses,
  validateSchedule,
} from "./core.js";

const $ = (selector) => document.querySelector(selector);
const elements = {
  fileInput: $("#file-input"), dropZone: $("#drop-zone"), sampleButton: $("#load-sample"),
  templateButton: $("#download-template"), pasteInput: $("#paste-input"), pasteButton: $("#parse-paste"),
  count: $("#course-count"), emptyState: $("#empty-state"), courseWrap: $("#course-table-wrap"),
  exportButton: $("#export-button"), semesterName: $("#semester-name"), semesterStart: $("#semester-start"),
  calendarName: $("#calendar-name"), timezone: $("#timezone"), periodList: $("#period-list"),
  addPeriod: $("#add-period"), toast: $("#toast"),
};
const defaultEmptyState = elements.emptyState.innerHTML;

const storedSettings = JSON.parse(localStorage.getItem("course-island.settings") || "null");
const storedPeriods = JSON.parse(localStorage.getItem("course-island.periods") || "null");
const state = {
  courses: [],
  periods: Array.isArray(storedPeriods) && storedPeriods.length ? storedPeriods : structuredClone(DEFAULT_PERIODS),
  settings: {
    semesterName: storedSettings?.semesterName || "新学期",
    semesterStart: storedSettings?.semesterStart || "",
    calendarName: storedSettings?.calendarName || "课程岛",
    timezone: storedSettings?.timezone || "Asia/Shanghai",
  },
  sourceName: "",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[char]);
}

function notify(message, kind = "success") {
  elements.toast.textContent = message;
  elements.toast.className = `toast is-visible ${kind}`;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => { elements.toast.className = "toast"; }, 3200);
}

function showImportError(message) {
  elements.count.innerHTML = '<span class="status-warning">导入失败 · 请查看原因</span>';
  elements.emptyState.hidden = false;
  elements.emptyState.innerHTML = `
    <div class="import-error-icon" aria-hidden="true">!</div>
    <h3>没有读取到课表</h3>
    <p class="import-error-message">${escapeHtml(message)}</p>
    <small>你可以重新选择文件，原文件不会被修改。</small>`;
}

function download(name, content, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function persist() {
  localStorage.setItem("course-island.settings", JSON.stringify(state.settings));
  localStorage.setItem("course-island.periods", JSON.stringify(state.periods));
}

function syncSettingsFromUi() {
  state.settings = {
    semesterName: elements.semesterName.value.trim(), semesterStart: elements.semesterStart.value,
    calendarName: elements.calendarName.value.trim(), timezone: elements.timezone.value,
  };
  persist();
  renderStatus();
}

function renderPeriods() {
  elements.periodList.innerHTML = state.periods.map((period, index) => `
    <div class="period-row" data-index="${index}">
      <label><span>节次</span><input data-field="id" value="${escapeHtml(period.id)}" aria-label="节次" /></label>
      <label><span>开始</span><input data-field="start" type="time" value="${escapeHtml(period.start)}" aria-label="开始时间" /></label>
      <span class="time-dash">—</span>
      <label><span>结束</span><input data-field="end" type="time" value="${escapeHtml(period.end)}" aria-label="结束时间" /></label>
      <button class="icon-button" data-action="remove-period" type="button" aria-label="删除这个节次">×</button>
    </div>`).join("");
}

function renderStatus() {
  const issues = validateSchedule(state.courses, state.settings, state.periods);
  const errors = issues.filter((issue) => issue.level === "error");
  elements.exportButton.disabled = state.courses.length === 0 || errors.length > 0;
  if (!state.courses.length) elements.count.textContent = "等待导入";
  else if (errors.length) elements.count.innerHTML = `<span class="status-warning">${state.courses.length} 门课程 · ${errors.length} 项待补充</span>`;
  else elements.count.innerHTML = `<span class="status-ready">${state.courses.length} 门课程 · 可以导出</span>`;
  const existing = $("#issue-list");
  if (existing) existing.remove();
  if (issues.length && state.courses.length) {
    const list = document.createElement("div");
    list.id = "issue-list";
    list.className = "issue-list";
    list.innerHTML = `<strong>导出前还需要：</strong><ul>${issues.slice(0, 5).map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul>${issues.length > 5 ? `<small>另有 ${issues.length - 5} 项</small>` : ""}`;
    elements.courseWrap.prepend(list);
  }
}

function weekdayOptions(selected) {
  return ["<option value=''>选择</option>", ...WEEKDAY_NAMES.slice(1).map((name, value) => `<option value="${value + 1}" ${Number(selected) === value + 1 ? "selected" : ""}>${name}</option>`)].join("");
}

function periodOptions(selected) {
  const known = new Set(state.periods.map((period) => period.id));
  const options = state.periods.map((period) => `<option value="${escapeHtml(period.id)}" ${period.id === selected ? "selected" : ""}>${escapeHtml(period.id)}节 · ${period.start}</option>`);
  if (selected && !known.has(selected)) options.unshift(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}节 · 未设时间</option>`);
  return ["<option value=''>选择</option>", ...options].join("");
}

function renderCourses() {
  const hasCourses = state.courses.length > 0;
  elements.emptyState.hidden = hasCourses;
  elements.courseWrap.hidden = !hasCourses;
  if (!hasCourses) { elements.courseWrap.innerHTML = ""; renderStatus(); return; }
  elements.courseWrap.innerHTML = `
    <div class="table-toolbar"><span>${escapeHtml(state.sourceName || "手动课表")}</span><button class="button ghost compact" data-action="add-course" type="button">添加课程</button></div>
    <div class="course-table" role="table" aria-label="课程核对表">
      <div class="course-row course-header" role="row"><span>课程</span><span>星期 / 节次</span><span>周次</span><span>教师 / 地点</span><span></span></div>
      ${state.courses.map((course, index) => `
        <div class="course-row" role="row" data-index="${index}">
          <label class="field course-title"><span>课程名称</span><input data-field="title" value="${escapeHtml(course.title)}" placeholder="课程名称" /></label>
          <div class="field-pair"><label class="field"><span>星期</span><select data-field="weekday">${weekdayOptions(course.weekday)}</select></label><label class="field"><span>节次</span><select data-field="period">${periodOptions(course.period)}</select></label></div>
          <label class="field"><span>${course.dates?.length ? "具体日期" : "周次"}</span><input data-field="weeks" value="${escapeHtml(course.dates?.length ? course.dates.join(",") : formatWeeks(course.weeks))}" placeholder="1-16周 / 1,3,5周" ${course.dates?.length ? "disabled" : ""} /></label>
          <div class="field-pair identity-fields"><label class="field"><span>教师</span><input data-field="teacher" value="${escapeHtml(course.teacher)}" placeholder="教师" /></label><label class="field"><span>地点</span><input data-field="room" value="${escapeHtml(course.room)}" placeholder="教室" /></label></div>
          <button class="icon-button delete-course" data-action="remove-course" type="button" aria-label="删除 ${escapeHtml(course.title || "课程")}">×</button>
        </div>`).join("")}
    </div>`;
  renderStatus();
}

function setCourses(courses, sourceName) {
  state.courses = courses.map((course, index) => normalizeCourse(course, index));
  state.sourceName = sourceName;
  renderCourses();
  notify(`已识别 ${state.courses.length} 门课程，请核对后导出`);
  $("#settings-grid").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function importFile(file) {
  if (!file) return;
  try {
    elements.emptyState.innerHTML = defaultEmptyState;
    const extension = file.name.toLowerCase().split(".").pop();
    elements.count.textContent = `正在识别 ${file.name}`;
    let courses;
    if (extension === "pdf") {
      const { extractPdfRows } = await import("./pdf-importer.js");
      const rows = await extractPdfRows(file, (page, total) => {
        elements.count.textContent = `正在读取 PDF · 第 ${page}/${total} 页`;
      });
      courses = parseTableRows(rows);
    } else if (extension === "xlsx") {
      const rows = await readXlsxFile(file, { dateFormat: "yyyy-mm-dd" });
      courses = parseTableRows(rows);
    } else courses = detectAndParseText(await file.text(), file.name);
    setCourses(courses, file.name);
  } catch (error) {
    console.error(error);
    notify(error.message || "没有识别出课程，请检查文件格式。", "error");
    renderStatus();
    showImportError(error.message || "没有识别出课程，请检查文件格式。");
  } finally { elements.fileInput.value = ""; }
}

elements.fileInput.addEventListener("change", () => importFile(elements.fileInput.files[0]));
for (const eventName of ["dragenter", "dragover"]) elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.add("is-dragging"); });
for (const eventName of ["dragleave", "drop"]) elements.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); elements.dropZone.classList.remove("is-dragging"); if (eventName === "drop") importFile(event.dataTransfer.files[0]); });

elements.sampleButton.addEventListener("click", () => {
  if (!state.settings.semesterStart) {
    const today = new Date(); const day = today.getDay() || 7; today.setDate(today.getDate() - day + 1);
    elements.semesterStart.value = today.toISOString().slice(0, 10); elements.semesterName.value = `${today.getFullYear()} 示例学期`; syncSettingsFromUi();
  }
  setCourses(sampleCourses(), "内置示例课表");
});

elements.templateButton.addEventListener("click", () => { download("课程岛导入模板.csv", `\uFEFF${csvTemplate()}`, "text/csv;charset=utf-8"); notify("模板已下载，可用 Excel 打开填写"); });
elements.pasteButton.addEventListener("click", () => {
  try { const text = elements.pasteInput.value.trim(); if (!text) throw new Error("请先粘贴课表内容。"); setCourses(detectAndParseText(text, "pasted.txt"), "粘贴的课表内容"); }
  catch (error) { notify(error.message || "没有识别出课程。", "error"); }
});

elements.courseWrap.addEventListener("input", (event) => {
  const row = event.target.closest(".course-row[data-index]");
  if (!row || !event.target.dataset.field) return;
  const course = state.courses[Number(row.dataset.index)]; const field = event.target.dataset.field;
  if (field === "weeks") course.weeks = parseWeeks(event.target.value);
  else if (field === "weekday") course.weekday = Number(event.target.value) || null;
  else course[field] = event.target.value;
  renderStatus();
});

elements.courseWrap.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "remove-course") { state.courses.splice(Number(event.target.closest(".course-row[data-index]").dataset.index), 1); renderCourses(); }
  else if (action === "add-course") { state.courses.push(normalizeCourse({ weeks: parseWeeks("1-16周") }, state.courses.length)); renderCourses(); const rows = elements.courseWrap.querySelectorAll(".course-row[data-index]"); rows[rows.length - 1]?.querySelector("input")?.focus(); }
});

elements.periodList.addEventListener("input", (event) => {
  const row = event.target.closest(".period-row"); if (!row || !event.target.dataset.field) return;
  state.periods[Number(row.dataset.index)][event.target.dataset.field] = event.target.value; persist(); renderCourses();
});
elements.periodList.addEventListener("click", (event) => {
  if (event.target.dataset.action !== "remove-period") return;
  state.periods.splice(Number(event.target.closest(".period-row").dataset.index), 1); persist(); renderPeriods(); renderCourses();
});
elements.addPeriod.addEventListener("click", () => { state.periods.push({ id: "", start: "08:00", end: "09:40" }); renderPeriods(); elements.periodList.lastElementChild?.querySelector("input")?.focus(); });
for (const element of [elements.semesterName, elements.semesterStart, elements.calendarName, elements.timezone]) element.addEventListener("input", syncSettingsFromUi);

elements.exportButton.addEventListener("click", () => {
  try {
    const ics = exportIcs(state.courses, state.settings, state.periods);
    const safeName = (state.settings.calendarName || "课程岛").replace(/[\\/:*?\"<>|]/g, "-");
    download(`${safeName}.ics`, ics, "text/calendar;charset=utf-8"); notify("日历文件已生成，可以导入系统日历");
  } catch (error) { notify(error.message, "error"); }
});

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  try {
    context.registerTool({
      name: "set_course_schedule", title: "设置课程表", description: "用结构化课程数据替换页面中正在编辑的课表，并刷新可见的核对表。",
      inputSchema: { type: "object", properties: { semesterName: { type: "string" }, semesterStart: { type: "string", description: "YYYY-MM-DD" }, courses: { type: "array", items: { type: "object", properties: { title: { type: "string" }, teacher: { type: "string" }, room: { type: "string" }, weekday: { type: "integer", minimum: 1, maximum: 7 }, period: { type: "string" }, weeks: { type: "array", items: { type: "integer", minimum: 1, maximum: 60 } } }, required: ["title", "weekday", "period", "weeks"] } } }, required: ["courses"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) { if (!input || !Array.isArray(input.courses)) throw new Error("courses 必须是数组"); if (input.semesterName) elements.semesterName.value = input.semesterName; if (input.semesterStart) elements.semesterStart.value = input.semesterStart; syncSettingsFromUi(); setCourses(input.courses, "AI 提供的结构化课表"); return { courseCount: state.courses.length, readyToExport: !elements.exportButton.disabled }; },
    });
  } catch (error) { console.debug("WebMCP unavailable", error); }
}

elements.semesterName.value = state.settings.semesterName; elements.semesterStart.value = state.settings.semesterStart;
elements.calendarName.value = state.settings.calendarName; elements.timezone.value = state.settings.timezone;
renderPeriods(); renderCourses(); registerWebMcpTools();
