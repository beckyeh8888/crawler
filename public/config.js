// API Configuration
window.CRAWLER_CONFIG = {
  getApiUrl: function() {
    // 生產環境：同源部署（Render）
    if (window.location.hostname.includes('onrender.com')) {
      return window.location.origin + '/api';
    }

    // 本地開發
    return 'http://localhost:3005/api';
  },

  fileExpiryMs: 300000,
  pollInterval: 3000
};
