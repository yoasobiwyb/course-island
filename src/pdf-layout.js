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
