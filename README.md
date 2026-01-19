# Site Content Crawler

一個智能的站內連結爬蟲，從起始 URL 開始沿著站內連結爬取整個網站，並將內容轉換成乾淨的 Markdown 格式，方便匯入 NotebookLM 或其他 AI 工具。

提供 **CLI** 和 **Web UI** 兩種使用方式。

## 特色功能

### 🎯 智能爬取
- **BFS 遍歷**：從起始 URL 廣度優先搜尋所有站內連結
- **同網域限制**：只爬取同網域或同路徑前綴的頁面
- **自動去重**：移除 URL hash 和追蹤參數（utm_*, fbclid 等）
- **斷點續爬**：已成功的頁面不重複抓取（除非使用 --force）

### 📄 內容抽取
- **Mozilla Readability**：智能抽取主要內容，自動過濾導覽列、頁尾、側欄
- **Turndown**：將 HTML 轉換成乾淨的 Markdown
- **動態頁面支援**：自動偵測內容過少時使用 Playwright 渲染
- **三層 Fallback**：Readability → main/article 元素 → 清理後的 body

### 🤝 禮貌爬取
- **尊重 robots.txt**：預設遵守（可用 --ignore-robots 略過）
- **並發控制**：預設 3 個並發請求，可調整
- **請求延遲**：預設每個請求間隔 300ms，避免過載伺服器
- **頁數限制**：預設最多 2000 頁，可調整

### 📦 輸出格式
爬取後會產生以下檔案：

```
out/
├── pages/              # 每頁一個 .md 檔案
│   ├── index.md
│   ├── docs_guide.md
│   └── ...
├── index.csv           # 爬取結果索引
├── failed.csv          # 失敗的 URL 列表
├── merged_01.md        # 合併分卷（每卷最多 350k 字元）
├── merged_02.md
└── merged_manifest.csv # 分卷清單
```

## 安裝

```bash
# Clone 專案
cd C:\Users\beck8\Projects\crawler

# 安裝依賴
npm install

# 編譯 TypeScript
npm run build
```

### 系統需求

- Node.js 16+
- npm 或 yarn

## 使用方法

### 方式一：Web UI（推薦）

1. 啟動 Web 伺服器：

```bash
npm run server
```

2. 開啟瀏覽器訪問：

```
http://localhost:3001
```

3. 在網頁介面中：
   - 輸入起始 URL
   - 設定爬取參數（最大頁數、並發數等）
   - 點擊「開始爬取」
   - 爬取完成後可直接下載檔案

### 方式二：CLI

#### 基本爬取

```bash
# 爬取網站
node dist/cli.js crawl --start "https://example.com/docs/"

# 指定輸出目錄和頁數限制
node dist/cli.js crawl \
  --start "https://example.com/docs/" \
  --out output \
  --maxPages 500

# 完整參數範例
node dist/cli.js crawl \
  --start "https://example.com/docs/" \
  --out output \
  --maxPages 500 \
  --concurrency 3 \
  --delay 300 \
  --samePath true \
  --render auto
```

#### 合併分卷

```bash
# 將爬取的頁面合併成分卷
node dist/cli.js bundle \
  --in output/pages \
  --out output \
  --maxChars 350000
```

## CLI 參數說明

### crawl 命令

| 參數 | 簡寫 | 預設值 | 說明 |
|------|------|--------|------|
| `--start` | `-s` | *必填* | 起始 URL |
| `--out` | `-o` | `out` | 輸出目錄 |
| `--maxPages` | `-m` | `2000` | 最多爬取頁數 |
| `--concurrency` | `-c` | `3` | 並發請求數 |
| `--delay` | `-d` | `300` | 請求間隔（毫秒） |
| `--samePath` | | `true` | 只爬取同路徑前綴 |
| `--ignoreRobots` | | `false` | 忽略 robots.txt |
| `--render` | | `auto` | 渲染模式：never / auto / always |
| `--force` | | `false` | 強制重新爬取 |

### bundle 命令

| 參數 | 簡寫 | 預設值 | 說明 |
|------|------|--------|------|
| `--in` | `-i` | *必填* | 輸入目錄（pages 資料夾） |
| `--out` | `-o` | `out` | 輸出目錄 |
| `--maxChars` | `-m` | `350000` | 每卷最大字元數 |

## 渲染模式說明

- **never**：永不使用 Playwright，僅用 axios 抓取靜態 HTML
- **auto**（推薦）：先用 axios，如果內容太少（< 50 字）則自動改用 Playwright
- **always**：所有頁面都用 Playwright 渲染（較慢但適合重度 JS 網站）

## 使用範例

### 範例 1：爬取文件網站

```bash
# 爬取 Next.js 文件
node dist/cli.js crawl \
  --start "https://nextjs.org/docs" \
  --out nextjs-docs \
  --maxPages 1000 \
  --samePath true

# 合併成分卷
node dist/cli.js bundle \
  --in nextjs-docs/pages \
  --out nextjs-docs
```

### 範例 2：爬取部落格

```bash
# 爬取整個網域（不限路徑）
node dist/cli.js crawl \
  --start "https://blog.example.com/" \
  --samePath false \
  --maxPages 500 \
  --concurrency 2 \
  --delay 500
```

### 範例 3：爬取 SPA 應用

```bash
# 使用 Playwright 渲染所有頁面
node dist/cli.js crawl \
  --start "https://spa-site.com/" \
  --render always \
  --maxPages 200 \
  --concurrency 1 \
  --delay 1000
```

### 範例 4：使用 Web UI

1. 啟動伺服器：
```bash
npm run server
```

2. 開啟瀏覽器訪問 `http://localhost:3001`

3. 輸入參數並開始爬取，爬取完成後可直接下載檔案

## Web API 端點

如果你想整合到自己的應用，可以使用以下 API：

### POST /api/crawl
開始爬取任務

```json
{
  "startUrl": "https://example.com/docs/",
  "maxPages": 2000,
  "concurrency": 3,
  "delay": 300,
  "samePath": true,
  "ignoreRobots": false,
  "renderMode": "auto"
}
```

### GET /api/jobs/:jobId
取得任務狀態

### GET /api/jobs
取得所有任務

### GET /api/download/:jobId/:filename
下載檔案

### GET /api/files/:jobId
列出任務的所有檔案

## 輸出檔案格式

### index.csv

```csv
url,title,status,wordCount,method,outFile
https://example.com/docs/,"Getting Started",success,1234,readability,index.md
https://example.com/docs/guide,"Guide",success,2345,readability,docs_guide.md
```

### failed.csv

```csv
url,error
https://example.com/404,"Request failed with status code 404"
https://example.com/timeout,"timeout of 30000ms exceeded"
```

### merged_manifest.csv

```csv
volume,charCount,pageCount
1,349856,45
2,287432,38
```

### 單頁 Markdown 格式

```markdown
# Page Title

**Source:** https://example.com/docs/guide
**Word Count:** 1234
**Method:** readability

---

[頁面內容...]
```

## 注意事項

### 合法性與道德

- 僅用於學習、研究或個人用途
- 爬取前確認網站的使用條款
- 預設遵守 robots.txt（除非明確使用 --ignore-robots）
- 不要過度爬取，避免對伺服器造成負擔

### 效能建議

- **小型網站**（< 100 頁）：可提高並發數到 5-10
- **大型網站**（> 1000 頁）：建議降低並發數到 2-3，增加延遲到 500-1000ms
- **動態網站**：使用 `--render auto` 或 `always`，但會顯著降低速度
- **斷點續爬**：大型爬取建議分批進行，善用斷點續爬功能

### 故障排除

**問題：爬取到的內容太少或是空白**
- 解決：使用 `--render auto` 或 `--render always`
- 原因：網站可能主要靠 JavaScript 渲染內容

**問題：被 robots.txt 阻擋**
- 解決：檢查 https://example.com/robots.txt
- 選項：使用 `--ignoreRobots`（需確認合法性）

**問題：請求被伺服器拒絕（429, 403）**
- 解決：降低並發數 `--concurrency 1`，增加延遲 `--delay 1000`

**問題：記憶體不足**
- 解決：降低 `--maxPages`，分批爬取

## 專案結構

```
crawler/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── server.ts           # Web API 伺服器
│   ├── crawler.ts          # 主要爬蟲引擎（BFS、並發控制）
│   ├── extractor.ts        # 內容抽取（Readability + Turndown）
│   ├── bundler.ts          # 分卷合併
│   └── utils/
│       ├── url.ts          # URL 正規化、去重、檔名生成
│       └── robots.ts       # robots.txt 處理
├── public/
│   └── index.html          # Web UI
├── package.json
├── tsconfig.json
└── README.md
```

## 核心依賴

- **@mozilla/readability**: 智能內容抽取
- **turndown**: HTML 轉 Markdown
- **playwright**: 動態頁面渲染
- **p-queue**: 並發控制與限流
- **axios**: HTTP 請求
- **jsdom**: DOM 解析
- **robots-parser**: robots.txt 解析
- **commander**: CLI 介面
- **express**: Web API 伺服器
- **cors**: CORS 支援

## 開發

```bash
# 開發模式（CLI）
npm run dev crawl -- --start "https://example.com"

# 開發模式（Web Server）
npm run server

# 編譯
npm run build

# 清理
npm run clean

# 生產環境運行 Web Server
npm run build
npm run server:prod
```

## License

MIT

## 貢獻

歡迎提交 Issue 或 Pull Request！

---

**提示**：爬取完成後，可以將 `merged_*.md` 檔案直接上傳到 NotebookLM 進行分析。
