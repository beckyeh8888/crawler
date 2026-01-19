import axios from 'axios';
import PQueue from 'p-queue';
import * as fs from 'fs/promises';
import * as path from 'path';
import { extractContent, closeBrowser, isContentTooShort, ExtractedContent } from './extractor';
import { normalizeUrl, shouldCrawlUrl, extractLinks, urlToFilename } from './utils/url';
import { isAllowedByRobots } from './utils/robots';
import { resolveOptimalUrl } from './utils/urlResolver';
import { autoOptimize } from './optimizer';
import { extractDomain, domainToPrefix } from './utils/domain';

export interface CrawlerOptions {
  startUrl: string;
  outputDir: string;
  maxPages?: number;
  concurrency?: number;
  delay?: number;
  samePath?: boolean;
  ignoreRobots?: boolean;
  renderMode?: 'never' | 'auto' | 'always';
  force?: boolean;
  mode?: 'auto' | 'manual';
  onProgress?: (current: number, total: number, queue: number) => void;
  onOptimized?: (settings: { concurrency: number; delay: number; reasoning: string }) => void;
}

export interface CrawlResult {
  url: string;
  title: string;
  status: 'success' | 'failed';
  wordCount: number;
  outFile: string;
  error?: string;
  method?: string;
}

export class Crawler {
  private options: Required<Omit<CrawlerOptions, 'onProgress' | 'onOptimized'>> & Pick<CrawlerOptions, 'onProgress' | 'onOptimized'>;
  private visited = new Set<string>();
  private queue: string[] = [];
  private results: CrawlResult[] = [];
  private failed: Array<{ url: string; error: string }> = [];
  private pQueue: PQueue;
  private domainPrefix: string = '';

  constructor(options: CrawlerOptions) {
    this.options = {
      maxPages: options.maxPages ?? 2000,
      concurrency: options.concurrency ?? 5,
      delay: options.delay ?? 150,
      samePath: options.samePath ?? true,
      ignoreRobots: options.ignoreRobots ?? false,
      renderMode: options.renderMode ?? 'auto',
      force: options.force ?? false,
      mode: options.mode ?? 'manual',
      onProgress: options.onProgress,
      onOptimized: options.onOptimized,
      ...options,
    };

    this.pQueue = new PQueue({
      concurrency: this.options.concurrency,
      interval: this.options.delay,
      intervalCap: 1,
    });
  }

  async crawl(): Promise<void> {
    // If auto mode, perform optimization first
    if (this.options.mode === 'auto') {
      try {
        console.log('🤖 Auto-optimization mode enabled');
        const optimized = await autoOptimize(this.options.startUrl);

        // Update settings
        this.options.concurrency = optimized.concurrency;
        this.options.delay = optimized.delay;

        // Recreate p-queue with new settings
        this.pQueue = new PQueue({
          concurrency: this.options.concurrency,
          interval: this.options.delay,
          intervalCap: 1,
        });

        // Notify frontend
        if (this.options.onOptimized) {
          this.options.onOptimized(optimized);
        }

        console.log('');
      } catch (error: any) {
        console.log('   ⚠️  Auto-optimization failed, using default settings');
        console.log(`   Error: ${error.message}`);
        console.log('');
      }
    }

    console.log('🚀 Starting crawler...');
    console.log(`   Start URL: ${this.options.startUrl}`);
    console.log(`   Output: ${this.options.outputDir}`);
    console.log(`   Max pages: ${this.options.maxPages}`);
    console.log(`   Concurrency: ${this.options.concurrency}`);
    console.log(`   Delay: ${this.options.delay}ms`);
    console.log(`   Same path only: ${this.options.samePath}`);
    console.log(`   Respect robots.txt: ${!this.options.ignoreRobots}`);
    console.log('');

    // Create output directories
    await this.setupOutputDir();

    // Load existing results if resuming
    if (!this.options.force) {
      await this.loadExistingResults();
    }

    // Resolve optimal URL format (auto-detect www)
    console.log('🔍 Detecting optimal URL format...');
    const resolved = await resolveOptimalUrl(this.options.startUrl);

    // Always update startUrl with the resolved URL (even if hostname didn't change)
    this.options.startUrl = resolved.url;

    if (resolved.modified) {
      console.log(`✓ Found: ${resolved.url} (${resolved.message})`);
    } else {
      console.log(`✓ Using: ${resolved.url}`);
    }
    console.log('');

    // Extract domain and calculate file naming prefix
    const domain = extractDomain(this.options.startUrl);
    this.domainPrefix = domainToPrefix(domain);
    console.log(`📝 File prefix: ${this.domainPrefix}`);

    // Normalize and add start URL
    const startUrl = normalizeUrl(this.options.startUrl);
    this.queue.push(startUrl);

    // BFS crawl
    while (this.queue.length > 0 && this.visited.size < this.options.maxPages) {
      const batchSize = Math.min(
        this.options.concurrency,
        this.queue.length,
        this.options.maxPages - this.visited.size
      );

      const batch = this.queue.splice(0, batchSize);

      await Promise.all(
        batch.map((url) =>
          this.pQueue.add(() => this.crawlPage(url))
        )
      );

      console.log(
        `\n📊 Progress: ${this.visited.size}/${this.options.maxPages} pages, ${this.queue.length} in queue`
      );

      // Call progress callback if provided
      if (this.options.onProgress) {
        this.options.onProgress(this.visited.size, this.options.maxPages, this.queue.length);
      }
    }

    // Close browser if used
    await closeBrowser();

    // Save results
    await this.saveResults();

    console.log('\n✅ Crawl complete!');
    console.log(`   Total pages: ${this.visited.size}`);
    console.log(`   Successful: ${this.results.filter((r) => r.status === 'success').length}`);
    console.log(`   Failed: ${this.failed.length}`);
    console.log(
      `   Total words: ${this.results.reduce((sum, r) => sum + r.wordCount, 0).toLocaleString()}`
    );
    console.log(
      `   Average words: ${Math.round(
        this.results.reduce((sum, r) => sum + r.wordCount, 0) / this.results.length
      ).toLocaleString()}`
    );
  }

  private async setupOutputDir(): Promise<void> {
    const pagesDir = path.join(this.options.outputDir, 'pages');
    await fs.mkdir(pagesDir, { recursive: true });
  }

  private async loadExistingResults(): Promise<void> {
    const indexPath = path.join(this.options.outputDir, 'index.csv');
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      const lines = content.split('\n').slice(1); // Skip header

      for (const line of lines) {
        if (!line.trim()) continue;

        const [url] = line.split(',');
        if (url) {
          const normalized = normalizeUrl(url);
          this.visited.add(normalized);
        }
      }

      console.log(`📂 Resumed: ${this.visited.size} pages already crawled`);
    } catch (e) {
      // No existing results, starting fresh
    }
  }

  private async crawlPage(url: string): Promise<void> {
    const normalized = normalizeUrl(url);

    // Skip if already visited
    if (this.visited.has(normalized)) {
      return;
    }

    this.visited.add(normalized);

    // Check robots.txt
    if (!this.options.ignoreRobots) {
      const allowed = await isAllowedByRobots(normalized);
      if (!allowed) {
        console.log(`🚫 Blocked by robots.txt: ${normalized}`);
        this.failed.push({ url: normalized, error: 'Blocked by robots.txt' });
        return;
      }
    }

    try {
      console.log(`📄 Crawling: ${normalized}`);

      let html = '';
      let content: ExtractedContent;

      // Try with Playwright first if renderMode is 'always'
      if (this.options.renderMode === 'always') {
        console.log(`   🎭 Using Playwright (forced mode)`);
        content = await extractContent('', normalized, true);
      } else {
        // Try axios first
        try {
          const response = await axios.get(normalized, {
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            },
            maxRedirects: 5,
            validateStatus: (status) => status >= 200 && status < 400,
          });

          // Check content type
          const contentType = response.headers['content-type'] || '';
          if (!contentType.includes('text/html')) {
            console.log(`⏭️  Skipping non-HTML: ${normalized}`);
            return;
          }

          html = response.data;
          content = await extractContent(html, normalized, false);

          // Auto-retry with Playwright if content too short
          if (
            this.options.renderMode === 'auto' &&
            isContentTooShort(content)
          ) {
            console.log(`   🔄 Retrying with Playwright (content too short)`);
            content = await extractContent('', normalized, true);
          }
        } catch (axiosError: any) {
          // If axios fails, try Playwright
          console.log(`   ⚠️  Axios failed: ${axiosError.message}`);
          console.log(`   🎭 Falling back to Playwright`);
          content = await extractContent('', normalized, true);
        }
      }

      // Save markdown
      const filename = urlToFilename(normalized);
      const filepath = path.join(this.options.outputDir, 'pages', filename);

      const markdown = `# ${content.title}\n\n**Source:** ${normalized}\n**Word Count:** ${content.wordCount}\n**Method:** ${content.method}\n\n---\n\n${content.markdown}`;

      await fs.writeFile(filepath, markdown, 'utf-8');

      this.results.push({
        url: normalized,
        title: content.title,
        status: 'success',
        wordCount: content.wordCount,
        outFile: filename,
        method: content.method,
      });

      console.log(
        `   ✓ Saved: ${content.title} (${content.wordCount} words, ${content.method})`
      );

      // Extract and queue new links (use rendered HTML if available)
      const linksHtml = content.html || html;
      const links = extractLinks(linksHtml, normalized);

      const newLinks = links.filter(
        (link) =>
          !this.visited.has(normalizeUrl(link)) &&
          shouldCrawlUrl(link, this.options.startUrl, this.options.samePath)
      );

      this.queue.push(...newLinks);

      console.log(`   🔗 Found ${newLinks.length} new links (from ${links.length} total)`);
    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      console.error(`   ✗ Failed: ${errorMsg}`);

      this.failed.push({
        url: normalized,
        error: errorMsg,
      });
    }
  }

  private async saveResults(): Promise<void> {
    // Save index.csv with UTF-8 BOM for Excel compatibility
    const indexPath = path.join(this.options.outputDir, `${this.domainPrefix}_index.csv`);
    const indexLines = [
      'url,title,status,wordCount,method,outFile',
      ...this.results.map((r) =>
        [
          r.url,
          `"${r.title.replace(/"/g, '""')}"`,
          r.status,
          r.wordCount,
          r.method || '',
          r.outFile,
        ].join(',')
      ),
    ];
    // Add UTF-8 BOM at the beginning
    const csvContent = '\uFEFF' + indexLines.join('\n');
    await fs.writeFile(indexPath, csvContent, 'utf-8');
    console.log(`\n💾 Saved index: ${indexPath}`);

    // Save failed.csv with UTF-8 BOM
    if (this.failed.length > 0) {
      const failedPath = path.join(this.options.outputDir, `${this.domainPrefix}_failed.csv`);
      const failedLines = [
        'url,error',
        ...this.failed.map((f) => [f.url, `"${f.error.replace(/"/g, '""')}"`].join(',')),
      ];
      // Add UTF-8 BOM at the beginning
      const csvContent = '\uFEFF' + failedLines.join('\n');
      await fs.writeFile(failedPath, csvContent, 'utf-8');
      console.log(`💾 Saved failures: ${failedPath}`);
    }
  }

  /**
   * Get the domain prefix for external use (e.g., by bundler)
   */
  public getDomainPrefix(): string {
    return this.domainPrefix;
  }
}
