export function groupPdfTextItemsIntoRows(items) {
  const positioned = items
    .filter((item) => item?.str?.trim())
    .map((item) => ({
      text: item.str.trim(),
      x: Number(item.transform?.[4] ?? 0),
      y: Number(item.transform?.[5] ?? 0),
      width: Math.max(Number(item.width ?? 0), 0),
      height: Math.max(Math.abs(Number(item.height ?? item.transform?.[3] ?? 10)), 6),
    }));

  const lines = [];
  for (const item of positioned.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2.5, item.height * 0.28));
    if (line) {
      line.items.push(item);
      line.y = (line.y + item.y) / 2;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const cells = [];
      for (const item of line.items.sort((a, b) => a.x - b.x)) {
        const previous = cells.at(-1);
        if (!previous) {
          cells.push({ text: item.text, end: item.x + item.width, height: item.height });
          continue;
        }
        const gap = item.x - previous.end;
        if (gap <= Math.max(5, Math.min(previous.height, item.height) * 0.65)) {
          previous.text += item.text;
          previous.end = Math.max(previous.end, item.x + item.width);
          previous.height = Math.max(previous.height, item.height);
        } else {
          cells.push({ text: item.text, end: item.x + item.width, height: item.height });
        }
      }
      return cells.map((cell) => cell.text.trim()).filter(Boolean);
    })
    .filter((row) => row.length);
}

export function normalizePdfTextItem(item, rotation = 0, view = [0, 0, 0, 0]) {
  const [left, bottom, right, top] = view;
  const rawX = Number(item.transform?.[4] ?? 0);
  const rawY = Number(item.transform?.[5] ?? 0);
  const normalizedRotation = ((Number(rotation) % 360) + 360) % 360;
  let x = rawX - left;
  let y = rawY - bottom;
  if (normalizedRotation === 90) {
    x = rawY - bottom;
    y = right - rawX;
  } else if (normalizedRotation === 180) {
    x = right - rawX;
    y = top - rawY;
  } else if (normalizedRotation === 270) {
    x = top - rawY;
    y = rawX - left;
  }
  return {
    ...item,
    transform: [Number(item.transform?.[0] ?? 0), Number(item.transform?.[1] ?? 0), Number(item.transform?.[2] ?? 0), Number(item.transform?.[3] ?? 0), x, y],
  };
}

export function validatePdfSignature(bytes) {
  const sample = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 4096)).trimStart();
  if (sample.startsWith("%PDF-")) return true;
  if (/<!doctype html|<html|<head|<body/i.test(sample)) {
    if (/错误提示|出错啦|系统运行异常/.test(sample)) {
      throw new Error("这个 .pdf 实际上是教务系统的错误网页，不是真正的 PDF。请在课表页面使用“打印 → 存储为 PDF”后再导入。");
    }
    throw new Error("这个文件虽然以 .pdf 结尾，内容实际是网页。请重新导出真正的 PDF 文件。");
  }
  throw new Error("文件扩展名是 .pdf，但没有检测到有效的 PDF 内容。");
}

const WEEKDAY_HEADERS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
const PERIOD_PATTERN = /\((\d{1,2})\s*-\s*(\d{1,2})节\)\s*([^/]*?周(?:[,，、]\s*第?\d+周)*)/;
const METADATA_PATTERN = /(?:校区|场地|教师|教学班|考核方式|课程学时|总学时|周学时|学分|学号|时间段|节次)[:：]?|\//;

function findWeekdayHeaderItems(items) {
  const lines = [];
  for (const item of items.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(3, item.height * 0.35));
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }

  for (const line of lines) {
    const characters = [];
    for (const item of line.items.sort((a, b) => a.x - b.x)) {
      const text = item.text.replace(/\s/g, "");
      if (!text) continue;
      const characterWidth = item.width > 0 ? item.width / text.length : item.height;
      Array.from(text).forEach((character, index) => {
        characters.push({
          character,
          x: item.x + (characterWidth * index),
          width: characterWidth,
          y: item.y,
        });
      });
    }
    const joined = characters.map((entry) => entry.character).join("");
    if (!WEEKDAY_HEADERS.every((label) => joined.includes(label))) continue;
    return WEEKDAY_HEADERS.map((label) => {
      const start = joined.indexOf(label);
      const matched = characters.slice(start, start + label.length);
      const left = matched[0].x;
      const right = matched.at(-1).x + matched.at(-1).width;
      return { text: label, x: left, width: right - left, y: matched[0].y };
    });
  }
  return null;
}

function linesForColumn(items, left, right, headerY = Infinity) {
  const lines = [];
  const selected = items.filter((item) => {
    const center = item.x + (item.width / 2);
    return center >= left && center < right && item.y < headerY - 1;
  });
  for (const item of selected.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2.5, item.height * 0.3));
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines.sort((a, b) => b.y - a.y).map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join("").trim()).filter(Boolean);
}

function titleStartIndex(lines, periodIndex) {
  let start = periodIndex - 1;
  while (start > 0) {
    const previous = lines[start - 1];
    if (!previous || METADATA_PATTERN.test(previous) || PERIOD_PATTERN.test(previous) || /^[:：]?\d+(?:\.\d+)?$/.test(previous)) break;
    start -= 1;
  }
  return Math.max(start, 0);
}

function parseCourseBlocks(lines, weekday) {
  const periodIndexes = lines.map((line, index) => PERIOD_PATTERN.test(line) ? index : -1).filter((index) => index >= 0);
  return periodIndexes.map((periodIndex, blockIndex) => {
    const match = lines[periodIndex].match(PERIOD_PATTERN);
    const start = titleStartIndex(lines, periodIndex);
    const nextPeriodIndex = periodIndexes[blockIndex + 1] ?? lines.length;
    const nextStart = blockIndex + 1 < periodIndexes.length ? titleStartIndex(lines, nextPeriodIndex) : lines.length;
    const title = lines.slice(start, periodIndex).join("").replace(/^\d+\s*/, "").trim();
    const details = lines.slice(periodIndex, nextStart).join("").replace(/\s+/g, "");
    const room = details.match(/场地[:：]([^/]+)/)?.[1] ?? "";
    const teacher = details.match(/教师[:：]([^/]+)/)?.[1] ?? "";
    return {
      title,
      teacher,
      room,
      weekday,
      period: `${match[1]}-${match[2]}`,
      weeks: match[3],
      notes: "由网格课表 PDF 识别",
      source: "pdf-grid",
    };
  }).filter((course) => course.title && course.weeks);
}

export function parseAcademicGridPages(pages) {
  if (!Array.isArray(pages) || !pages.length) return [];
  const headerItems = findWeekdayHeaderItems(pages[0]);
  if (!headerItems) return [];
  const centers = headerItems.map((item) => item.x + (item.width / 2));
  const boundaries = [
    centers[0] - ((centers[1] - centers[0]) / 2),
    ...centers.slice(0, -1).map((center, index) => (center + centers[index + 1]) / 2),
    centers.at(-1) + ((centers.at(-1) - centers.at(-2)) / 2),
  ];
  const headerY = Math.min(...headerItems.map((item) => item.y));
  const courses = [];
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const lines = pages.flatMap((items, pageIndex) => linesForColumn(
      items,
      boundaries[weekday - 1],
      boundaries[weekday],
      pageIndex === 0 ? headerY : Infinity,
    ));
    courses.push(...parseCourseBlocks(lines, weekday));
  }
  return courses;
}
