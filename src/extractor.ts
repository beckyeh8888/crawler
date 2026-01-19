import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { chromium, Browser } from 'playwright';

export interface ExtractedContent {
  title: string;
  markdown: string;
  wordCount: number;
  method: 'readability' | 'fallback' | 'playwright';
  html?: string; // Rendered HTML for link extraction
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Improve turndown rules
turndownService.addRule('removeComments', {
  filter: (node) => node.nodeType === 8,
  replacement: () => '',
});

turndownService.addRule('preserveCodeBlocks', {
  filter: ['pre'],
  replacement: (content, node: any) => {
    const code = node.querySelector('code');
    if (code) {
      const lang = code.className.match(/language-(\w+)/)?.[1] || '';
      return '\n```' + lang + '\n' + code.textContent + '\n```\n';
    }
    return '\n```\n' + content + '\n```\n';
  },
});

let browser: Browser | null = null;

/**
 * Extract main content from HTML using Mozilla Readability
 */
export async function extractContent(
  html: string,
  url: string,
  usePlaywright: boolean = false
): Promise<ExtractedContent> {
  if (usePlaywright) {
    return await extractWithPlaywright(url);
  }

  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article && article.textContent.trim().length > 100) {
      const markdown = turndownService.turndown(article.content);
      const wordCount = countWords(markdown);

      return {
        title: article.title || extractTitleFromDom(dom),
        markdown,
        wordCount,
        method: 'readability',
        html,
      };
    }
  } catch (e) {
    console.error('Readability failed:', e);
  }

  // Fallback: try to extract main/article content
  return extractFallback(html, url);
}

/**
 * Fallback extraction method
 */
function extractFallback(html: string, url: string): ExtractedContent {
  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Try to find main content
    let contentElement =
      doc.querySelector('main') ||
      doc.querySelector('article') ||
      doc.querySelector('[role="main"]') ||
      doc.querySelector('.content') ||
      doc.querySelector('#content');

    if (!contentElement) {
      // Remove unwanted elements
      const unwanted = doc.querySelectorAll(
        'nav, footer, header, aside, script, style, noscript, iframe, .nav, .footer, .header, .sidebar, .menu, .advertisement, .ad'
      );
      unwanted.forEach((el: Element) => el.remove());

      contentElement = doc.body;
    }

    const contentHtml = contentElement?.innerHTML || '';
    const markdown = turndownService.turndown(contentHtml);
    const wordCount = countWords(markdown);

    return {
      title: extractTitleFromDom(dom),
      markdown,
      wordCount,
      method: 'fallback',
      html,
    };
  } catch (e) {
    console.error('Fallback extraction failed:', e);
    return {
      title: 'Untitled',
      markdown: '',
      wordCount: 0,
      method: 'fallback',
    };
  }
}

/**
 * Extract content using Playwright (for JS-heavy sites)
 */
async function extractWithPlaywright(url: string): Promise<ExtractedContent> {
  try {
    if (!browser) {
      browser = await chromium.launch({ headless: true });
    }

    const page = await browser.newPage();

    try {
      // Try networkidle first with longer timeout (60s)
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    } catch (e: any) {
      if (e.name === 'TimeoutError') {
        // If networkidle times out, retry with domcontentloaded
        console.log('   ⏱️  networkidle timeout, retrying with domcontentloaded');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } else {
        await page.close();
        throw e;
      }
    }

    // Detect if this is a SPA (Vue, React, Angular, etc.)
    const isSPA = await page.evaluate(() => {
      return !!(
        (window as any).__NUXT__ ||
        (window as any).__NEXT_DATA__ ||
        (window as any).Vue ||
        (window as any).React ||
        document.querySelector('[data-reactroot]') ||
        document.querySelector('[data-v-]') ||
        document.querySelector('#__next') ||
        document.querySelector('#app[data-v-app]')
      );
    });

    // Wait longer for SPAs to render dynamic content
    if (isSPA) {
      console.log('   🎭 SPA detected, waiting for dynamic content...');

      // Wait for navigation elements to appear (try multiple selectors)
      try {
        await Promise.race([
          page.waitForSelector('nav a[href]', { timeout: 5000 }),
          page.waitForSelector('header a[href]', { timeout: 5000 }),
          page.waitForSelector('[role="navigation"] a[href]', { timeout: 5000 }),
          page.waitForTimeout(5000), // Fallback: just wait 5 seconds
        ]);
      } catch (e) {
        // Timeout is ok, just continue
      }

      // Additional wait for any lazy-loaded content
      await page.waitForTimeout(1000);
    } else {
      await page.waitForTimeout(500); // Standard wait for non-SPAs
    }

    const html = await page.content();
    const title = await page.title();

    await page.close();

    // Use readability on the rendered HTML
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article) {
      const markdown = turndownService.turndown(article.content);
      const wordCount = countWords(markdown);

      return {
        title: article.title || title,
        markdown,
        wordCount,
        method: 'playwright',
        html,
      };
    }

    // Fallback
    return extractFallback(html, url);
  } catch (e) {
    console.error('Playwright extraction failed:', e);
    throw e;
  }
}

/**
 * Close Playwright browser
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Extract title from DOM
 */
function extractTitleFromDom(dom: JSDOM): string {
  const doc = dom.window.document;
  return (
    doc.querySelector('title')?.textContent?.trim() ||
    doc.querySelector('h1')?.textContent?.trim() ||
    'Untitled'
  );
}

/**
 * Count words in markdown
 */
function countWords(text: string): number {
  // Remove code blocks
  const withoutCode = text.replace(/```[\s\S]*?```/g, '');
  // Remove links
  const withoutLinks = withoutCode.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Count words
  const words = withoutLinks.trim().split(/\s+/);
  return words.filter((w) => w.length > 0).length;
}

/**
 * Check if content is too short (might need Playwright)
 */
export function isContentTooShort(content: ExtractedContent): boolean {
  return content.wordCount < 100 && content.method !== 'playwright';
}
