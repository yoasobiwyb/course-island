import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/build/pdf.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { groupPdfTextItemsIntoRows, validatePdfSignature } from "./pdf-layout.js";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfRows(file, onProgress = () => {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  validatePdfSignature(bytes);
  const task = getDocument({ data: bytes });
  let document;
  try {
    document = await task.promise;
  } catch (error) {
    if (error?.name === "PasswordException") throw new Error("这个 PDF 有密码保护，请解除密码后再导入。");
    throw new Error("PDF 无法读取，文件可能损坏或格式不完整。");
  }

  const rows = [];
  let textItemCount = 0;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress(pageNumber, document.numPages);
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      textItemCount += content.items.filter((item) => item?.str?.trim()).length;
      rows.push(...groupPdfTextItemsIntoRows(content.items));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  if (!textItemCount) {
    throw new Error("这个 PDF 只有图片，没有可提取文字。目前请先用 OCR 转成 Excel、CSV 或 JSON 后再导入。");
  }
  return rows;
}
