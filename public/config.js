// API Configuration
window.CRAWLER_CONFIG = {
  getApiUrl: function() {
    // GitHub Pages 環境
    if (window.location.hostname.includes('github.io')) {
      // 部署後需替換為實際的 Render URL
      return 'https://YOUR_RENDER_APP_NAME.onrender.com/api';
    }

    // 本地開發
    return 'http://localhost:3005/api';
  },

  fileExpiryMs: 300000,
  pollInterval: 3000
};
