#!/usr/bin/env node

import { Command } from 'commander';
import { Crawler } from './crawler';
import { Bundler } from './bundler';

const program = new Command();

program
  .name('site-crawler')
  .description('A site-wide content crawler that extracts clean Markdown')
  .version('1.0.0');

program
  .command('crawl')
  .description('Crawl a website and extract content to Markdown')
  .requiredOption('-s, --start <url>', 'Starting URL')
  .option('-o, --out <dir>', 'Output directory', 'out')
  .option('-m, --maxPages <number>', 'Maximum pages to crawl', '2000')
  .option('-c, --concurrency <number>', 'Concurrent requests', '3')
  .option('-d, --delay <ms>', 'Delay between requests (ms)', '300')
  .option('--samePath <boolean>', 'Only crawl same path prefix', 'true')
  .option('--ignoreRobots', 'Ignore robots.txt', false)
  .option('--render <mode>', 'Render mode: never|auto|always', 'auto')
  .option('--force', 'Force re-crawl (ignore existing)', false)
  .action(async (options) => {
    try {
      const crawler = new Crawler({
        startUrl: options.start,
        outputDir: options.out,
        maxPages: parseInt(options.maxPages, 10),
        concurrency: parseInt(options.concurrency, 10),
        delay: parseInt(options.delay, 10),
        samePath: options.samePath === 'true',
        ignoreRobots: options.ignoreRobots,
        renderMode: options.render as 'never' | 'auto' | 'always',
        force: options.force,
      });

      await crawler.crawl();
    } catch (error: any) {
      console.error('❌ Crawl failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('bundle')
  .description('Bundle crawled pages into merged volumes')
  .requiredOption('-i, --in <dir>', 'Input directory (pages folder)')
  .option('-o, --out <dir>', 'Output directory', 'out')
  .option('-m, --maxChars <number>', 'Max characters per volume', '350000')
  .action(async (options) => {
    try {
      const bundler = new Bundler({
        inputDir: options.in,
        outputDir: options.out,
        maxChars: parseInt(options.maxChars, 10),
      });

      await bundler.bundle();
    } catch (error: any) {
      console.error('❌ Bundle failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
