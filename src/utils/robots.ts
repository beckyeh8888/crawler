import axios from 'axios';
import robotsParser from 'robots-parser';

const robotsCache = new Map<string, any>();

/**
 * Check if URL is allowed by robots.txt
 */
export async function isAllowedByRobots(
  urlString: string,
  userAgent: string = 'SiteContentCrawler/1.0'
): Promise<boolean> {
  try {
    const url = new URL(urlString);
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;

    // Check cache
    if (!robotsCache.has(robotsUrl)) {
      try {
        const response = await axios.get(robotsUrl, {
          timeout: 5000,
          validateStatus: (status) => status === 200 || status === 404
        });

        if (response.status === 200) {
          const robots = robotsParser(robotsUrl, response.data);
          robotsCache.set(robotsUrl, robots);
        } else {
          // No robots.txt, allow all
          robotsCache.set(robotsUrl, null);
        }
      } catch (e) {
        // Error fetching robots.txt, allow by default
        robotsCache.set(robotsUrl, null);
      }
    }

    const robots = robotsCache.get(robotsUrl);
    if (!robots) {
      return true; // No robots.txt or error, allow
    }

    return robots.isAllowed(urlString, userAgent) ?? true;
  } catch (e) {
    // Error parsing URL, disallow
    return false;
  }
}
