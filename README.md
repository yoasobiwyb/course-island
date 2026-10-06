# 课程岛转换器

一个纯前端、本地优先的课表转换网页。用户上传或粘贴课表，在浏览器中核对后导出标准 `.ics` 文件，可导入 Apple 日历并供 iPhone / Apple Watch 快捷指令读取。

## 当前支持

- Excel：`.xlsx`
- 文字型 PDF：`.pdf`（支持课程列表和常见“星期 × 节次”网格课表，并在浏览器本地提取文字）
- CSV、制表符分隔文本
- ICS 日历
- JSON 课程数组（包括嵌套在 `courses`、`courseList`、`data` 等字段中的数组）
- HTML 中的通用表格
- WakeUp 兼容 JSON（`courseName`、`startNode`、`startWeek` 等字段）
- 使用“字段：内容”组织的普通文本
- 中文/英文常用列名自动映射
- 周次范围、离散周次、单双周
- 可编辑课程、学期日期、时区和节次时间
- 稳定 UID、`📚` 标题标记和 `CATEGORIES:课程岛`

所有文件默认只在浏览器本地解析，不会上传到服务器。

直接使用：[课程岛在线版](https://yoasobiwyb.github.io/course-island/)

## 配套快捷指令

- [下一节课 · 灵动岛版](https://www.icloud.com/shortcuts/cd95b4e5d6a240a0b6f2644b34958291)：在支持灵动岛的 iPhone 上显示课程信息，需要同时安装下面的 Start Live Activity。
- [下一节课 · Apple Watch 版](https://www.icloud.com/shortcuts/5d00fab90814478ab2539a3e374d82fc)：可在 Apple Watch 或 iPhone 上运行，不需要额外的灵动岛显示软件。
- [Start Live Activity](https://www.icloud.com/shortcuts/f4a69c8326084039be14545f0e562fce)：接收课程文本并交给 LiveShortcut 显示实时活动。

推荐先用转换器生成并导入课程日历。灵动岛用户先安装 Start Live Activity，再安装灵动岛版；其他用户直接选择 Apple Watch 版。首次运行时允许快捷指令访问日历，并选择课程所在的日历。

## 开发

需要 Node.js 22 和 pnpm：

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm test
pnpm build
```

构建结果在 `dist/`，部署到 GitHub Pages 后即可直接使用。

## 发布到 GitHub Pages

1. 在 GitHub 创建空仓库，将本项目推送到 `main` 分支。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment** 中将 Source 选择为 **GitHub Actions**。
4. 推送后，仓库自带的工作流会运行测试、构建并发布网页。

`vite.config.js` 使用相对资源路径，因此项目站点和自定义域名都可以正常工作。

## 推荐导入表头

| 课程名称 | 教师 | 地点 | 星期 | 节次 | 周次 | 开始时间 | 结束时间 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 高等数学 | 张老师 | A201 | 周一 | 1-2 | 1-16周 | 08:00 | 09:45 |  |

未提供开始/结束时间时，系统会使用网页中设置的“节次时间”。

## 项目结构

```text
src/core.js       解析、规范化、校验和 ICS 生成
src/main.js       文件导入和页面交互
src/styles.css    响应式界面
examples/         可直接测试的示例文件
tests/            核心转换测试
```

## 增加教务系统适配器

解析器只需输出统一课程对象：

```js
{
  title: "课程名称",
  teacher: "教师",
  room: "地点",
  weekday: 1,
  period: "1-2",
  weeks: [1, 2, 3, 4]
}
```

将新格式的识别逻辑添加到 `src/core.js`，并在 `tests/` 中加入一份脱敏样例和测试。不要提交真实姓名、学号、登录凭据或未经脱敏的课表。

## 限制

- 扫描件或纯图片 PDF 尚不能直接识别；页面会提示先用 OCR/AI 转成 JSON 或模板表格。
- PDF 需要包含可选择的文字和明确的星期、节次信息；少数特殊排版仍可能需要学校专用适配器。
- WakeUp 官方的限时在线分享口令依赖远程接口，当前本地版不请求该接口；请改用 WakeUp 导出的 JSON 文件。
- 各学校教务系统结构不同，通用 HTML 解析器只处理有明确表头的课程列表。复杂网格课表需要独立适配器。
- 导入系统日历前，建议新建独立的“课程岛”日历，便于整学期删除或替换。

## 许可证

[MIT](LICENSE)
