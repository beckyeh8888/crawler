# 快速開始指南

## 🚀 30 秒上手

### 1. 安裝依賴

```bash
cd C:\Users\beck8\Projects\crawler
npm install
```

### 2. 編譯專案

```bash
npm run build
```

### 3. 選擇使用方式

#### 方式 A：Web UI（推薦新手）

```bash
npm run server
```

然後開啟瀏覽器訪問：**http://localhost:3001**

在網頁中：
1. 輸入起始 URL（例如：`https://nextjs.org/docs`）
2. 設定參數（使用預設值即可）
3. 點擊「開始爬取」
4. 等待完成後下載檔案

#### 方式 B：命令列（CLI）

```bash
# 基本用法
node dist/cli.js crawl --start "https://example.com/docs/"

# 完整範例
node dist/cli.js crawl \
  --start "https://nextjs.org/docs" \
  --out nextjs-docs \
  --maxPages 500
```

## 📁 輸出檔案位置

### Web UI 模式
輸出在：`output/<job-id>/`
- `pages/` - 每頁獨立的 Markdown
- `index.csv` - 所有頁面索引
- `merged_01.md` - 合併後的文件（可直接上傳 NotebookLM）

### CLI 模式
輸出在你指定的 `--out` 目錄（預設 `out/`）

## 🎯 常見使用場景

### 1. 爬取技術文件

```bash
node dist/cli.js crawl \
  --start "https://nextjs.org/docs" \
  --out nextjs-docs \
  --maxPages 1000
```

### 2. 爬取部落格

```bash
node dist/cli.js crawl \
  --start "https://blog.example.com" \
  --samePath false \
  --maxPages 500
```

### 3. 爬取 SPA 應用（JavaScript 渲染）

```bash
node dist/cli.js crawl \
  --start "https://app.example.com" \
  --render always \
  --maxPages 100
```

## ⚙️ 重要參數說明

| 參數 | 說明 | 預設值 | 推薦值 |
|------|------|--------|--------|
| `--maxPages` | 最多爬幾頁 | 2000 | 500-1000 |
| `--concurrency` | 同時幾個請求 | 3 | 2-5 |
| `--delay` | 請求間隔（毫秒） | 300 | 300-1000 |
| `--samePath` | 只爬同路徑 | true | 文件用 true，部落格用 false |
| `--render` | 渲染模式 | auto | auto（自動偵測） |

## 🔧 故障排除

### 問題：內容是空白的
**解決方案：** 使用 `--render always`

```bash
node dist/cli.js crawl --start "你的URL" --render always
```

### 問題：被網站封鎖（403/429）
**解決方案：** 降低速度

```bash
node dist/cli.js crawl \
  --start "你的URL" \
  --concurrency 1 \
  --delay 1000
```

### 問題：想要繼續之前中斷的爬取
**解決方案：** 使用相同的輸出目錄即可自動續爬

```bash
# 第一次（中斷）
node dist/cli.js crawl --start "URL" --out mydata

# 繼續爬取（自動跳過已完成的）
node dist/cli.js crawl --start "URL" --out mydata
```

## 📤 匯入 NotebookLM

1. 爬取完成後，找到 `merged_01.md` 檔案
2. 前往 [NotebookLM](https://notebooklm.google.com/)
3. 建立新筆記本
4. 上傳 `merged_01.md`（如果太大，分別上傳 `merged_01.md`, `merged_02.md` 等）
5. 開始提問！

## 💡 小技巧

### 先測試小範圍

```bash
# 先爬 10 頁測試
node dist/cli.js crawl --start "URL" --maxPages 10 --out test
```

### 查看爬取統計

爬取完成後會顯示：
- 成功頁數
- 失敗頁數
- 總字數
- 平均字數

### 查看失敗原因

檢查 `failed.csv` 檔案查看哪些頁面失敗及原因。

## 🆘 需要幫助？

詳細文件請參考：[README.md](README.md)

---

祝爬取愉快！🎉
