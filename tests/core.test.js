import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PERIODS, exportIcs, normalizeCourse, parseCsv, parseWeeks } from "../src/core.js";
import { groupPdfTextItemsIntoRows, normalizePdfTextItem, parseAcademicGridPages, validatePdfSignature } from "../src/pdf-layout.js";

test("周次支持范围、列表和单双周", () => {
  assert.deepEqual(parseWeeks("1-6周"), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parseWeeks("1-8周（单）"), [1, 3, 5, 7]);
  assert.deepEqual(parseWeeks("2,4,8周"), [2, 4, 8]);
});

test("CSV 表头能映射成统一课程字段", () => {
  const courses = parseCsv("课程名称,教师,地点,星期,节次,周次\n高等数学,张老师,A201,周一,1-2,1-16周");
  assert.equal(courses[0].title, "高等数学");
  assert.equal(courses[0].weekday, 1);
  assert.equal(courses[0].period, "1-2");
  assert.equal(courses[0].weeks.length, 16);
});

test("ICS 使用稳定 UID 并展开教学周", () => {
  const settings = { semesterName: "测试学期", semesterStart: "2026-09-07", calendarName: "课程岛", timezone: "Asia/Shanghai" };
  const courses = [{ title: "高等数学", teacher: "张老师", room: "A201", weekday: 1, period: "1-2", weeks: [1, 2], dates: [] }];
  const first = exportIcs(courses, settings, DEFAULT_PERIODS);
  const second = exportIcs(courses, settings, DEFAULT_PERIODS);
  const firstUids = first.match(/UID:.+/g);
  const secondUids = second.match(/UID:.+/g);
  assert.deepEqual(firstUids, secondUids);
  assert.equal((first.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(first, /DTSTART;TZID=Asia\/Shanghai:20260907T080000/);
  assert.match(first, /SUMMARY:📚 高等数学/);
});

test("WakeUp JSON 字段会转换为统一课程", () => {
  const course = normalizeCourse({ courseName: "离散数学", day: 3, startNode: 3, endNode: 4, startWeek: 1, endWeek: 8, type: 1, teacher: "王老师", room: "B202" });
  assert.equal(course.title, "离散数学");
  assert.equal(course.weekday, 3);
  assert.equal(course.period, "3-4");
  assert.deepEqual(course.weeks, [1, 3, 5, 7]);
});

test("PDF 文字项按坐标重建为表格行", () => {
  const item = (str, x, y, width = 48) => ({ str, width, height: 12, transform: [12, 0, 0, 12, x, y] });
  const rows = groupPdfTextItemsIntoRows([
    item("课程名称", 20, 700), item("星期", 150, 700), item("节次", 230, 700), item("周次", 310, 700),
    item("高等数学", 20, 670), item("周一", 150, 670), item("1-2", 230, 670), item("1-16周", 310, 670),
  ]);
  assert.deepEqual(rows, [["课程名称", "星期", "节次", "周次"], ["高等数学", "周一", "1-2", "1-16周"]]);
});

test("横向 PDF 会把旋转坐标还原为可视页面坐标", () => {
  const normalized = normalizePdfTextItem({ str: "星期一", transform: [12, 0, 0, 12, 74, 133] }, 90, [0, 0, 595, 842]);
  assert.equal(normalized.transform[4], 133);
  assert.equal(normalized.transform[5], 521);
});

test("伪装成 PDF 的教务错误网页会得到明确提示", () => {
  const bytes = new TextEncoder().encode("<!doctype html><title>错误提示</title><p>出错啦！</p>");
  assert.throws(() => validatePdfSignature(bytes), /教务系统的错误网页/);
});

test("教务系统网格 PDF 按星期列识别课程", () => {
  const item = (text, x, y, width = 40) => ({ text, x, y, width, height: 10 });
  const page = [
    ...["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"].map((text, index) => item(text, 120 + (index * 100), 520, 36)),
    item("高等数学", 105, 480, 50),
    item("(1-2节)1-16周/校区:本部/场地:A201/教师:张老师/教学班:01", 105, 465, 90),
    item("毛泽东思想和中国特色", 405, 400, 90),
    item("社会主义理论体系概论", 405, 388, 90),
    item("(5-6节)10-16周/校区:本部/场地:B302/教师:李老师/教学班:02", 405, 375, 90),
  ];
  const courses = parseAcademicGridPages([page]);
  assert.equal(courses.length, 2);
  assert.deepEqual(courses[0], { title: "高等数学", teacher: "张老师", room: "A201", weekday: 1, period: "1-2", weeks: "1-16周", notes: "由网格课表 PDF 识别", source: "pdf-grid" });
  assert.equal(courses[1].weekday, 4);
  assert.equal(courses[1].title, "毛泽东思想和中国特色社会主义理论体系概论");
});

test("网格 PDF 的星期标题拆成单字时仍可识别", () => {
  const item = (text, x, y, width = 12) => ({ text, x, y, width, height: 10 });
  const page = [];
  ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"].forEach((label, dayIndex) => {
    Array.from(label).forEach((character, characterIndex) => page.push(item(character, 120 + (dayIndex * 100) + (characterIndex * 12), 520)));
  });
  page.push(item("离散数学", 105, 480, 50));
  page.push(item("(1-2节)1-8周/校区:本部/场地:A101/教师:王老师/教学班:01", 105, 465, 90));
  const courses = parseAcademicGridPages([page]);
  assert.equal(courses.length, 1);
  assert.equal(courses[0].title, "离散数学");
  assert.equal(courses[0].weekday, 1);
});

test("课程详情跨 PDF 分页时会连续读取", () => {
  const item = (text, x, y, width = 40) => ({ text, x, y, width, height: 10 });
  const firstPage = [
    ...["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"].map((text, index) => item(text, 120 + (index * 100), 520, 36)),
    item("大学物理实验(1)", 205, 80, 70),
    item("(9-10节)第11周/校区:本部/场地:实验室9/教师:杨", 205, 65, 90),
  ];
  const secondPage = [item("学英/教学班:大学物理实验(1)-01", 205, 540, 90)];
  const courses = parseAcademicGridPages([firstPage, secondPage]);
  assert.equal(courses.length, 1);
  assert.equal(courses[0].teacher, "杨学英");
  assert.equal(courses[0].room, "实验室9");
});
