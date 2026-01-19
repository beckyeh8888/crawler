import axios from 'axios';

/**
 * 網站特性分析器和參數優化器
 */
export class CrawlerOptimizer {
  private startUrl: string;
  private testResults: {
    avgResponseTime: number;
    requiresPlaywright: boolean;
    serverLoad: 'low' | 'medium' | 'high';
  } | null = null;

  constructor(startUrl: string) {
    this.startUrl = startUrl;
  }

  /**
   * 分析網站特性並返回最佳參數
   */
  async optimize(): Promise<{
    concurrency: number;
    delay: number;
    reasoning: string;
  }> {
    console.log('🤖 Auto-optimization mode: analyzing website...');

    // 步驟 1：測試首頁響應速度
    const responseTime = await this.measureResponseTime();

    // 步驟 2：檢測是否需要 Playwright
    const needsPlaywright = await this.detectPlaywrightRequirement();

    // 步驟 3：評估伺服器負載容忍度
    const serverLoad = this.estimateServerLoad(responseTime);

    this.testResults = {
      avgResponseTime: responseTime,
      requiresPlaywright: needsPlaywright,
      serverLoad,
    };

    // 步驟 4：計算最佳參數
    return this.calculateOptimalParams();
  }

  /**
   * 測量網站響應時間
   */
  private async measureResponseTime(): Promise<number> {
    const startTime = Date.now();

    try {
      const response = await axios.get(this.startUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const responseTime = Date.now() - startTime;
      console.log(`   ⏱️  Response time: ${responseTime}ms`);
      return responseTime;
    } catch (error) {
      // 如果 axios 失敗，可能需要 Playwright
      console.log(`   ⚠️  Axios failed, may require Playwright`);
      return 5000; // 預設較慢的響應時間
    }
  }

  /**
   * 檢測是否需要 Playwright 渲染
   */
  private async detectPlaywrightRequirement(): Promise<boolean> {
    try {
      const response = await axios.get(this.startUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const html = response.data;

      // 簡單啟發式檢測：
      // 1. HTML 內容很少（< 1000 字元）
      // 2. 包含大量 JavaScript 框架標記
      const htmlLength = html.length;
      const hasReactMarkers = html.includes('__NEXT_DATA__') || html.includes('reactRoot');
      const hasVueMarkers = html.includes('v-app') || html.includes('data-v-');
      const hasSPAMarkers = html.includes('<div id="app"></div>') || html.includes('<div id="root"></div>');

      const needsPlaywright = htmlLength < 1000 || hasReactMarkers || hasVueMarkers || hasSPAMarkers;

      console.log(`   🎭 Playwright required: ${needsPlaywright ? 'Yes' : 'No'}`);
      return needsPlaywright;
    } catch (error) {
      // 預設需要 Playwright
      return true;
    }
  }

  /**
   * 評估伺服器負載容忍度
   */
  private estimateServerLoad(responseTime: number): 'low' | 'medium' | 'high' {
    if (responseTime < 500) {
      // 快速響應 = 伺服器性能好，可承受較高並發
      return 'low';
    } else if (responseTime < 2000) {
      // 中等響應 = 適中並發
      return 'medium';
    } else {
      // 慢速響應 = 降低並發，增加延遲
      return 'high';
    }
  }

  /**
   * 根據測試結果計算最佳參數
   */
  private calculateOptimalParams(): {
    concurrency: number;
    delay: number;
    reasoning: string;
  } {
    if (!this.testResults) {
      throw new Error('Must run optimize() first');
    }

    const { avgResponseTime, requiresPlaywright, serverLoad } = this.testResults;

    let concurrency: number;
    let delay: number;
    let reasoning: string;

    // 決策矩陣
    if (requiresPlaywright) {
      // Playwright 渲染較慢，降低並發
      if (serverLoad === 'low') {
        concurrency = 3;
        delay = 200;
        reasoning = '網站使用 JavaScript 渲染，採用中等速度以確保完整載入';
      } else if (serverLoad === 'medium') {
        concurrency = 2;
        delay = 300;
        reasoning = '網站使用 JavaScript 渲染且響應較慢，降低爬取速度';
      } else {
        concurrency = 1;
        delay = 500;
        reasoning = '網站使用 JavaScript 渲染且伺服器負載高，採用保守策略';
      }
    } else {
      // 靜態頁面，可以更快
      if (serverLoad === 'low') {
        concurrency = 8;
        delay = 100;
        reasoning = '網站響應快速，採用高速爬取';
      } else if (serverLoad === 'medium') {
        concurrency = 5;
        delay = 150;
        reasoning = '網站響應正常，採用標準速度';
      } else {
        concurrency = 3;
        delay = 300;
        reasoning = '網站響應較慢，降低爬取速度以減輕伺服器負擔';
      }
    }

    console.log(`   ✓ Optimized settings: concurrency=${concurrency}, delay=${delay}ms`);
    console.log(`   💡 Reasoning: ${reasoning}`);

    return { concurrency, delay, reasoning };
  }

  /**
   * 獲取測試結果（用於顯示）
   */
  getTestResults() {
    return this.testResults;
  }
}

/**
 * 快速使用函數
 */
export async function autoOptimize(startUrl: string): Promise<{
  concurrency: number;
  delay: number;
  reasoning: string;
}> {
  const optimizer = new CrawlerOptimizer(startUrl);
  return await optimizer.optimize();
}
