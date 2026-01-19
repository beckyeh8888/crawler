# 部署指南

本文檔說明如何將爬蟲系統部署到 GitHub Pages（前端）和 Render（後端）。

## 前置要求

- Git 已安裝
- GitHub 帳號
- Render 帳號（免費）https://render.com
- Node.js 16+ 已安裝

---

## 快速部署步驟

### 1. 初始化 Git 並推送到 GitHub

```bash
cd C:\Users\beck8\Projects\crawler

# 初始化 Git（如果還沒有）
git init
git add .
git commit -m "feat: Add cloud deployment configuration

- Add environment variable support with dotenv
- Configure CORS for production
- Add GitHub Actions workflow for Pages deployment
- Add Render configuration
- Update frontend to use dynamic API URL
- Add health check endpoint"

# 創建 GitHub repository
# 訪問 https://github.com/new
# Repository 名稱: site-content-crawler
# 設為 Public（GitHub Pages 免費版要求）

# 連接並推送
git remote add origin https://github.com/YOUR_USERNAME/site-content-crawler.git
git branch -M main
git push -u origin main
```

### 2. 配置 GitHub Pages

1. 前往 repository settings: `https://github.com/YOUR_USERNAME/site-content-crawler/settings/pages`
2. Source 選擇: **GitHub Actions**
3. 保存
4. 前往 Actions 頁面確認 workflow 運行成功
5. 記錄前端 URL: `https://YOUR_USERNAME.github.io/site-content-crawler/`

### 3. 部署到 Render

#### 3.1 創建服務

1. 登錄 https://dashboard.render.com/
2. 點擊 "New +" → "Web Service"
3. 選擇 "Connect GitHub"
4. 授權並選擇 `site-content-crawler` repository

#### 3.2 配置服務

- **Name**: `site-content-crawler`（或自訂名稱）
- **Region**: Oregon (US West)
- **Branch**: `main`
- **Root Directory**: (留空)
- **Environment**: `Node`
- **Build Command**: `npm install && npx playwright install --with-deps chromium && npm run build`
- **Start Command**: `npm run server:prod`
- **Plan**: `Free`

#### 3.3 設置環境變量

點擊 "Advanced" → "Add Environment Variable"，添加：

```
NODE_ENV = production
PORT = 10000
FILE_EXPIRY_MS = 300000
OUTPUT_DIR = /tmp/crawler-output
ALLOWED_ORIGINS = https://YOUR_USERNAME.github.io
```

**重要**: 將 `YOUR_USERNAME` 替換為你的實際 GitHub 用戶名！

#### 3.4 部署並記錄 URL

1. 點擊 "Create Web Service"
2. 等待首次部署完成（3-5 分鐘）
3. 部署成功後，記錄 Render URL（例如：`https://site-content-crawler-xxxx.onrender.com`）

### 4. 更新前端配置

修改 `public/config.js`，將 Render URL 填入：

```javascript
// 找到這一行
return 'https://YOUR_RENDER_APP_NAME.onrender.com/api';

// 改為實際 URL，例如：
return 'https://site-content-crawler-abc123.onrender.com/api';
```

推送更新：

```bash
git add public/config.js
git commit -m "Update Render backend URL"
git push
```

等待 GitHub Actions 重新部署（約 1-2 分鐘）。

---

## 驗證部署

### 驗證後端

測試健康檢查：

```bash
curl https://site-content-crawler-xxxx.onrender.com/health
```

預期返回：

```json
{
  "status": "ok",
  "timestamp": "2026-01-20T...",
  "environment": "production",
  "uptime": 123.456
}
```

測試 CORS：

```bash
curl -H "Origin: https://YOUR_USERNAME.github.io" \
  -v https://site-content-crawler-xxxx.onrender.com/api/jobs
```

應該看到 header: `Access-Control-Allow-Origin: https://YOUR_USERNAME.github.io`

### 驗證前端

1. 訪問 `https://YOUR_USERNAME.github.io/site-content-crawler/`
2. 打開瀏覽器開發者工具（F12）
3. 查看 Console，確認顯示：`🔗 API URL: https://site-content-crawler-xxxx.onrender.com/api`
4. 確認顯示 "✅ 已連接到服務器"
   - 如果顯示冷啟動提示，等待 30-50 秒後刷新

### 完整功能測試

1. 在前端頁面提交爬蟲任務（例如 `https://example.com`，最大頁數 5）
2. 觀察進度更新是否正常
3. 任務完成後點擊下載按鈕測試
4. 等待 5 分鐘，確認任務變為 "已過期" 狀態

---

## 故障排除

### 問題 1: Render 冷啟動慢

**現象**: 首次訪問需要 30-50 秒

**原因**: Render 免費層在 15 分鐘無活動後會休眠服務器

**解決方案**:
1. 前端已添加提示訊息
2. 可選：使用 UptimeRobot 監控（https://uptimerobot.com/ 免費）
   - 添加監控 URL: `https://your-app.onrender.com/health`
   - 監控間隔: 5 分鐘

### 問題 2: CORS 錯誤

**現象**: 前端無法連接後端，Console 顯示 CORS 錯誤

**檢查清單**:
1. Render 環境變量 `ALLOWED_ORIGINS` 是否正確
2. GitHub Pages URL 是否正確（注意大小寫和協議 https://）
3. 後端日誌中的 "Allowed origins" 是否包含前端 URL

**調試**:

```bash
# 查看 Render 日誌
# 前往 Render Dashboard → Logs

# 測試 CORS headers
curl -H "Origin: https://YOUR_USERNAME.github.io" \
  -v https://your-app.onrender.com/health
```

### 問題 3: GitHub Pages 404

**解決步驟**:
1. 確認 Repository Settings → Pages → Source 設為 "GitHub Actions"
2. 前往 Actions 頁面檢查 workflow 運行日誌
3. 確認 `public/` 目錄存在且包含 `index.html`
4. 確認 `.github/workflows/deploy-pages.yml` 配置正確

### 問題 4: 構建失敗

**Render 構建失敗**:
1. 查看 Render → Logs 中的錯誤訊息
2. 確認 `package.json` 的 scripts 正確
3. 本地測試構建: `npm run build`

**GitHub Actions 構建失敗**:
1. 前往 Actions 頁面查看詳細日誌
2. 確認 workflow 文件格式正確
3. 確認 repository 有 Pages 權限

---

## 成本說明

### 完全免費

- **GitHub Pages**: 免費（1GB 儲存，100GB/月 流量）
- **Render**: 免費（750 小時/月運行時間，足夠 24/7）

### 可選升級

如果需要更好的性能：

- **Render Starter**: $7/月
  - 無休眠（秒級響應）
  - 持久磁盤存儲
  - 更多資源

- **UptimeRobot Pro**: $7/月
  - 1 分鐘監控間隔（減少休眠）
  - 更多監控項目

---

## 後續維護

### 更新代碼

```bash
# 修改代碼後
git add .
git commit -m "描述性訊息"
git push

# GitHub Actions 會自動部署前端
# Render 會自動部署後端（如果配置了 autoDeploy）
```

### 查看日誌

- **前端**: 瀏覽器開發者工具 Console
- **後端**: Render Dashboard → Logs

### 監控服務

- **GitHub Pages**: https://github.com/YOUR_USERNAME/site-content-crawler/actions
- **Render**: https://dashboard.render.com/

---

## 進階配置

### 自定義域名

如果你有自己的域名：

#### GitHub Pages
1. Repository Settings → Pages → Custom domain
2. 添加你的域名（例如：`crawler.yourdomain.com`）
3. 在 DNS 提供商添加 CNAME 記錄指向 `YOUR_USERNAME.github.io`

#### Render
1. Render Dashboard → Settings → Custom Domains
2. 添加你的域名
3. 按照指示配置 DNS

別忘記更新 `public/config.js` 和 Render 環境變量中的 URL！

### 添加監控

推薦使用 UptimeRobot 監控後端：

1. 註冊 https://uptimerobot.com/
2. Add New Monitor
   - Monitor Type: HTTP(s)
   - URL: `https://your-app.onrender.com/health`
   - Monitoring Interval: 5 minutes
3. 保存

這樣可以大幅減少冷啟動情況。

---

## 技術架構

```
用戶瀏覽器
    ↓
GitHub Pages (靜態前端)
https://YOUR_USERNAME.github.io/site-content-crawler/
    ↓ (AJAX 請求)
Render 後端 API
https://site-content-crawler-xxxx.onrender.com/api
    ↓
臨時文件存儲 (/tmp/crawler-output)
自動過期清理 (5 分鐘)
```

### 文件過期機制

- 爬蟲完成後，文件有 5 分鐘有效期
- 過期後自動刪除（節省空間）
- 前端顯示倒數計時和過期提示
- 用戶可重新掃描獲取新文件

---

## 支持

如有問題，請檢查：

1. [GitHub Actions 日誌](https://github.com/YOUR_USERNAME/site-content-crawler/actions)
2. [Render 日誌](https://dashboard.render.com/)
3. 瀏覽器開發者工具 Console 和 Network

祝部署順利！🚀
