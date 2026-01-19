/**
 * Domain extraction and conversion utilities for crawler file naming
 */

/**
 * Extract domain from URL (without www and protocol)
 * Examples:
 *   https://www.skytek.com.tw/about → skytek.com.tw
 *   http://example.com → example.com
 *   alleypin.com/tw → alleypin.com
 */
export function extractDomain(url: string): string {
  try {
    // Add protocol if missing for URL parsing
    const urlWithProtocol = url.includes('://') ? url : `https://${url}`;
    const parsed = new URL(urlWithProtocol);
    let hostname = parsed.hostname;

    // Remove www prefix
    hostname = hostname.replace(/^www\./, '');

    return hostname;
  } catch (e) {
    // If URL parsing fails, try string extraction
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    return match ? match[1] : 'unknown';
  }
}

/**
 * Convert domain to safe filename prefix
 * Examples:
 *   skytek.com.tw → skytek
 *   example.co.uk → example
 *   test-site.com → test-site
 */
export function domainToPrefix(domain: string): string {
  // Split by dots
  const parts = domain.split('.');

  // Keep only the main domain part (first segment)
  if (parts.length >= 2) {
    return parts[0];
  }

  // Fallback: sanitize entire domain
  return domain.replace(/[^a-zA-Z0-9-]/g, '_');
}
