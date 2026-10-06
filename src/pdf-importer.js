import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/build/pdf.mjs";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { groupPdfTextItemsIntoRows, normalizePdfTextItem, validatePdfSignature } from "./pdf-layout.js";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfRows(file, onProgress = () => {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  validatePdfSignature(bytes);
  const task = getDocument({
    data: bytes,
    cMapUrl: new URL("./cmaps/", document.baseURI).toString(),
    cMapPacked: true,
  });
  let pdfDocument;
  try {
    pdfDocument = await task.promise;
  } catch (error) {
    if (error?.name === "PasswordException") throw new Error("这个 PDF 有密码保护，请解除密码后再导入。");
    throw new Error("PDF 无法读取，文件可能损坏或格式不完整。");
  }

  const rows = [];
  const pages = [];
  let textItemCount = 0;
  try {
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      onProgress(pageNumber, pdfDocument.numPages);
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();
      const normalizedItems = content.items.map((item) => normalizePdfTextItem(item, page.rotate, page.view));
      textItemCount += normalizedItems.filter((item) => item?.str?.trim()).length;
      rows.push(...groupPdfTextItemsIntoRows(normalizedItems));
      pages.push(normalizedItems.filter((item) => item?.str?.trim()).map((item) => ({
        text: item.str.trim(),
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
        width: Math.max(Number(item.width ?? 0), 0),
        height: Math.max(Math.abs(Number(item.height ?? item.transform?.[3] ?? 10)), 6),
      })));
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  if (!textItemCount) {
    throw new Error("这个 PDF 只有图片，没有可提取文字。目前请先用 OCR 转成 Excel、CSV 或 JSON 后再导入。");
  }
  return { rows, pages };
}
