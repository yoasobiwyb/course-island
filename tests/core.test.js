import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PERIODS, exportIcs, normalizeCourse, parseCsv, parseWeeks } from "../src/core.js";

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
