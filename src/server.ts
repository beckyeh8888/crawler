import express from 'express';
import cors from 'cors';
import path from 'path';
import { Crawler } from './crawler';
import { Bundler } from './bundler';
import * as fs from 'fs/promises';
import { extractDomain, domainToPrefix } from './utils/domain';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FILE_EXPIRY_MS_CONFIG = parseInt(process.env.FILE_EXPIRY_MS || '300000', 10);
const OUTPUT_BASE_DIR = process.env.OUTPUT_DIR || path.join(__dirname, '../output');

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3005'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

interface CrawlJob {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'expired';
  startUrl: string;
  domain: string;
  domainPrefix: string;
  startTime: Date;
  completedTime?: Date;
  expiryTime?: Date;
  progress: {
    current: number;
    total: number;
    queue: number;
  };
  results?: {
    outputDir: string;
    jobId: string;
    files?: string[];
    optimizationSettings?: {
      concurrency: number;
      delay: number;
      reasoning: string;
    };
  };
  error?: string;
}

const jobs = new Map<string, CrawlJob>();

// File expiry time: from environment or default 5 minutes
const FILE_EXPIRY_MS = FILE_EXPIRY_MS_CONFIG;

// Start crawl
app.post('/api/crawl', async (req, res) => {
  try {
    const {
      startUrl,
      maxPages = 2000,
      concurrency,
      delay,
      samePath = true,
      ignoreRobots = false,
      renderMode = 'auto',
      mode = 'auto',
    } = req.body;

    if (!startUrl) {
      return res.status(400).json({ error: 'startUrl is required' });
    }

    const jobId = Date.now().toString();
    const outputDir = path.join(OUTPUT_BASE_DIR, jobId);

    // Extract domain information
    const domain = extractDomain(startUrl);
    const domainPrefix = domainToPrefix(domain);

    const job: CrawlJob = {
      id: jobId,
      status: 'running',
      startUrl,
      domain,
      domainPrefix,
      startTime: new Date(),
      progress: {
        current: 0,
        total: maxPages,
        queue: 0,
      },
    };

    jobs.set(jobId, job);

    // Start crawl in background
    (async () => {
      try {
        const crawlerOptions: any = {
          startUrl,
          outputDir,
          maxPages: parseInt(maxPages, 10),
          samePath: samePath === true || samePath === 'true',
          ignoreRobots: ignoreRobots === true || ignoreRobots === 'true',
          renderMode: renderMode as 'never' | 'auto' | 'always',
          force: false,
          mode: mode as 'auto' | 'manual',
          onProgress: (current: number, total: number, queue: number) => {
            job.progress = { current, total, queue };
          },
          onOptimized: (settings: { concurrency: number; delay: number; reasoning: string }) => {
            // Store optimization results in job
            if (job.results) {
              job.results.optimizationSettings = settings;
            }
          },
        };

        // Only include concurrency and delay if manual mode
        if (mode === 'manual') {
          crawlerOptions.concurrency = parseInt(concurrency || '5', 10);
          crawlerOptions.delay = parseInt(delay || '150', 10);
        }

        const crawler = new Crawler(crawlerOptions);

        await crawler.crawl();

        // Get domain prefix from crawler
        const crawlerDomainPrefix = crawler.getDomainPrefix();

        // Auto-bundle after crawl
        const bundler = new Bundler({
          inputDir: path.join(outputDir, 'pages'),
          outputDir,
          maxChars: 350000,
          domainPrefix: crawlerDomainPrefix,
        });

        await bundler.bundle();

        job.status = 'completed';
        job.completedTime = new Date();
        job.expiryTime = new Date(Date.now() + FILE_EXPIRY_MS);
        job.results = {
          outputDir,
          jobId,
        };
      } catch (error: any) {
        job.status = 'failed';
        job.error = error.message;
      }
    })();

    res.json({ jobId, message: 'Crawl started' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get job status
app.get('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(job);
});

// Get all jobs
app.get('/api/jobs', (req, res) => {
  const allJobs = Array.from(jobs.values());
  res.json(allJobs);
});

// Download files
app.get('/api/download/:jobId/:filename', async (req, res) => {
  try {
    const { jobId, filename } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if expired
    if (job.status === 'expired' || (job.expiryTime && Date.now() > job.expiryTime.getTime())) {
      return res.status(410).json({
        error: 'File expired',
        message: 'Files have expired after 5 minutes. Please re-crawl the website.',
        expiredAt: job.expiryTime
      });
    }

    const filepath = path.join(OUTPUT_BASE_DIR, jobId, filename);

    const exists = await fs.access(filepath).then(() => true).catch(() => false);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filepath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List output files
app.get('/api/files/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const outputDir = path.join(OUTPUT_BASE_DIR, jobId);

    const files = await fs.readdir(outputDir);
    const fileList = [];

    for (const file of files) {
      const stats = await fs.stat(path.join(outputDir, file));
      if (stats.isFile()) {
        fileList.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
        });
      }
    }

    res.json(fileList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime()
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Site Content Crawler API',
    version: '1.0.0',
    endpoints: {
      crawl: 'POST /api/crawl',
      jobs: 'GET /api/jobs',
      job: 'GET /api/jobs/:jobId',
      download: 'GET /api/download/:jobId/:filename',
      files: 'GET /api/files/:jobId'
    }
  });
});

// Ensure output directory exists
async function ensureOutputDir() {
  try {
    await fs.mkdir(OUTPUT_BASE_DIR, { recursive: true });
    console.log(`✅ Output directory ready: ${OUTPUT_BASE_DIR}`);
  } catch (error) {
    console.error('❌ Failed to create output directory:', error);
  }
}

ensureOutputDir();

// Automatic cleanup of expired files (runs every 60 seconds)
setInterval(async () => {
  const now = Date.now();

  for (const [jobId, job] of jobs.entries()) {
    if (job.status === 'completed' && job.expiryTime) {
      if (now > job.expiryTime.getTime()) {
        // Delete output directory
        if (job.results?.outputDir) {
          try {
            await fs.rm(job.results.outputDir, { recursive: true, force: true });
            console.log(`🗑️  Cleaned expired job: ${jobId} (${job.domain})`);
          } catch (e) {
            console.error(`Failed to clean job ${jobId}:`, e);
          }
        }

        // Update job status
        job.status = 'expired';
        job.results = undefined;
      }
    }
  }
}, 60000); // Run every 60 seconds

app.listen(PORT, () => {
  console.log(`🚀 Crawler server running on http://localhost:${PORT}`);
  console.log(`📁 Output directory: ${OUTPUT_BASE_DIR}`);
  console.log(`⏱️  File expiry: ${FILE_EXPIRY_MS / 1000}s`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔐 Allowed origins: ${allowedOrigins.join(', ')}`);
});
