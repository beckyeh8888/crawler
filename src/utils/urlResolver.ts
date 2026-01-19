import * as dns from 'dns/promises';
import { URL } from 'url';

/**
 * Smart URL resolver that automatically detects whether a domain needs 'www.' prefix
 */
export class UrlResolver {
  private domainPatterns = new Map<string, 'www' | 'no-www'>();

  /**
   * Resolve the optimal URL format for a domain
   */
  async resolve(url: string): Promise<string> {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      const baseDomain = this.extractBaseDomain(hostname);

      // Check if we already know the pattern for this domain
      if (this.domainPatterns.has(baseDomain)) {
        const pattern = this.domainPatterns.get(baseDomain)!;
        return this.applyPattern(url, pattern);
      }

      // First time seeing this domain, detect the pattern
      const pattern = await this.detectPattern(url);
      this.domainPatterns.set(baseDomain, pattern);

      return this.applyPattern(url, pattern);
    } catch (error) {
      // If URL parsing fails, return original
      return url;
    }
  }

  /**
   * Detect whether a domain works with 'www' or without
   */
  private async detectPattern(url: string): Promise<'www' | 'no-www'> {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const hasWww = hostname.startsWith('www.');

    // Test current format
    const currentWorks = await this.testUrl(url);
    if (currentWorks) {
      return hasWww ? 'www' : 'no-www';
    }

    // Test alternative format
    const alternativeUrl = hasWww
      ? url.replace('www.', '')
      : url.replace(/^(https?:\/\/)/, '$1www.');

    const alternativeWorks = await this.testUrl(alternativeUrl);
    if (alternativeWorks) {
      return hasWww ? 'no-www' : 'www';
    }

    // Both failed, return current format
    return hasWww ? 'www' : 'no-www';
  }

  /**
   * Test if a URL is accessible via DNS lookup
   */
  private async testUrl(url: string): Promise<boolean> {
    try {
      const hostname = new URL(url).hostname;
      await dns.resolve(hostname);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract base domain (e.g., "example.com" from "www.example.com")
   */
  private extractBaseDomain(hostname: string): string {
    return hostname.replace(/^www\./, '');
  }

  /**
   * Apply the detected pattern to a URL
   */
  private applyPattern(url: string, pattern: 'www' | 'no-www'): string {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const hasWww = hostname.startsWith('www.');

    if (pattern === 'www' && !hasWww) {
      parsedUrl.hostname = 'www.' + hostname;
    } else if (pattern === 'no-www' && hasWww) {
      parsedUrl.hostname = hostname.replace(/^www\./, '');
    }

    return parsedUrl.href;
  }

  /**
   * Get the detected pattern for a domain (for debugging/logging)
   */
  getPattern(domain: string): 'www' | 'no-www' | undefined {
    const baseDomain = domain.replace(/^www\./, '');
    return this.domainPatterns.get(baseDomain);
  }
}

/**
 * Quick utility function to resolve optimal URL
 */
export async function resolveOptimalUrl(input: string): Promise<{
  url: string;
  modified: boolean;
  message?: string;
}> {
  try {
    const resolver = new UrlResolver();
    const originalUrl = input.includes('://') ? input : `https://${input}`;
    const resolvedUrl = await resolver.resolve(originalUrl);

    const originalHostname = new URL(originalUrl).hostname;
    const resolvedHostname = new URL(resolvedUrl).hostname;

    const modified = originalHostname !== resolvedHostname;
    let message: string | undefined;

    if (modified) {
      if (resolvedHostname.startsWith('www.') && !originalHostname.startsWith('www.')) {
        message = 'added www';
      } else if (!resolvedHostname.startsWith('www.') && originalHostname.startsWith('www.')) {
        message = 'removed www';
      }
    }

    return {
      url: resolvedUrl,
      modified,
      message,
    };
  } catch (error) {
    // Fallback to original input with https:// if needed
    const url = input.includes('://') ? input : `https://${input}`;
    return {
      url,
      modified: false,
    };
  }
}
