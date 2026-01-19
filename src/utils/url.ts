import { URL } from 'url';

/**
 * Normalize URL: auto-add protocol, remove hash, clean tracking params
 */
export function normalizeUrl(urlString: string): string {
  try {
    // Auto-add protocol if missing
    let processedUrl = urlString.trim();

    // Check if URL has a protocol (e.g., http://, https://, ftp://)
    if (!processedUrl.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:/)) {
      processedUrl = 'https://' + processedUrl;
    }

    const url = new URL(processedUrl);

    // Remove hash
    url.hash = '';

    // Remove tracking params
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid',
      '_ga', '_gl', 'ref', 'source'
    ];

    trackingParams.forEach(param => url.searchParams.delete(param));

    // Remove trailing slash for consistency (except for root)
    let pathname = url.pathname;
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
      url.pathname = pathname;
    }

    return url.href;
  } catch (e) {
    // If still fails, try adding https:// and retry
    if (!urlString.includes('://')) {
      try {
        return normalizeUrl('https://' + urlString);
      } catch (e2) {
        return urlString;
      }
    }
    return urlString;
  }
}

/**
 * Check if URL should be crawled
 */
export function shouldCrawlUrl(
  urlString: string,
  baseUrl: string,
  samePath: boolean
): boolean {
  try {
    const url = new URL(urlString);
    const base = new URL(baseUrl);

    // Skip non-http(s) protocols
    if (!url.protocol.startsWith('http')) {
      return false;
    }

    // Skip mailto, tel, etc.
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') {
      return false;
    }

    // Must be same domain
    if (url.hostname !== base.hostname) {
      return false;
    }

    // If samePath is true, must share the same path prefix
    if (samePath) {
      const basePath = base.pathname.endsWith('/')
        ? base.pathname
        : base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);

      if (!url.pathname.startsWith(basePath)) {
        return false;
      }
    }

    // Skip common non-HTML extensions
    const skipExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
      '.pdf', '.zip', '.tar', '.gz', '.rar',
      '.mp4', '.mp3', '.avi', '.mov',
      '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.css', '.js', '.json', '.xml', '.ico'
    ];

    const pathname = url.pathname.toLowerCase();
    if (skipExtensions.some(ext => pathname.endsWith(ext))) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Extract all links from HTML
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      const absoluteUrl = new URL(href, baseUrl).href;
      links.push(absoluteUrl);
    } catch (e) {
      // Invalid URL, skip
    }
  }

  return links;
}

/**
 * Generate safe filename from URL
 */
export function urlToFilename(urlString: string): string {
  try {
    const url = new URL(urlString);
    let path = url.pathname;

    // Remove leading/trailing slashes
    path = path.replace(/^\/+|\/+$/g, '');

    // Replace slashes with underscores
    path = path.replace(/\//g, '_');

    // If empty (root path), use 'index'
    if (!path) {
      path = 'index';
    }

    // Add query params if present
    if (url.search) {
      const query = url.search.substring(1)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50);
      path += '_' + query;
    }

    // Sanitize: keep only alphanumeric, underscore, hyphen, dot
    path = path.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Limit length
    if (path.length > 200) {
      const hash = simpleHash(urlString);
      path = path.substring(0, 180) + '_' + hash;
    }

    return path + '.md';
  } catch (e) {
    // Fallback: use hash
    return 'page_' + simpleHash(urlString) + '.md';
  }
}

/**
 * Simple hash function for generating short IDs
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
