import * as fs from 'fs/promises';
import * as path from 'path';

export interface BundleOptions {
  inputDir: string;
  outputDir: string;
  maxChars?: number;
  domainPrefix?: string;
}

interface VolumeInfo {
  volume: number;
  charCount: number;
  pageCount: number;
  files: string[];
}

export class Bundler {
  private options: Required<BundleOptions>;
  private domainPrefix: string;

  constructor(options: BundleOptions) {
    this.options = {
      maxChars: options.maxChars ?? 350000,
      domainPrefix: options.domainPrefix ?? 'merged',
      ...options,
    };
    this.domainPrefix = this.options.domainPrefix;
  }

  async bundle(): Promise<void> {
    console.log('📚 Starting bundler...');
    console.log(`   Input: ${this.options.inputDir}`);
    console.log(`   Output: ${this.options.outputDir}`);
    console.log(`   Max chars per volume: ${this.options.maxChars.toLocaleString()}`);
    console.log('');

    // Get all markdown files
    const files = await this.getMarkdownFiles();
    console.log(`📄 Found ${files.length} markdown files`);

    if (files.length === 0) {
      console.log('⚠️  No markdown files found');
      return;
    }

    // Read and bundle files
    const volumes = await this.createVolumes(files);

    // Write volumes
    await this.writeVolumes(volumes);

    // Write manifest
    await this.writeManifest(volumes);

    console.log('\n✅ Bundling complete!');
    console.log(`   Total volumes: ${volumes.length}`);
    console.log(`   Total pages: ${files.length}`);
    console.log(
      `   Total characters: ${volumes.reduce((sum, v) => sum + v.charCount, 0).toLocaleString()}`
    );
  }

  private async getMarkdownFiles(): Promise<string[]> {
    const files = await fs.readdir(this.options.inputDir);
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => path.join(this.options.inputDir, f));
  }

  private async createVolumes(files: string[]): Promise<VolumeInfo[]> {
    const volumes: VolumeInfo[] = [];
    let currentVolume: VolumeInfo = {
      volume: 1,
      charCount: 0,
      pageCount: 0,
      files: [],
    };

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const charCount = content.length;

      // Check if adding this file would exceed the limit
      if (
        currentVolume.charCount > 0 &&
        currentVolume.charCount + charCount > this.options.maxChars
      ) {
        // Save current volume and start a new one
        volumes.push(currentVolume);
        currentVolume = {
          volume: volumes.length + 1,
          charCount: 0,
          pageCount: 0,
          files: [],
        };
      }

      // Add file to current volume
      currentVolume.files.push(file);
      currentVolume.charCount += charCount;
      currentVolume.pageCount++;
    }

    // Add the last volume
    if (currentVolume.files.length > 0) {
      volumes.push(currentVolume);
    }

    return volumes;
  }

  private async writeVolumes(volumes: VolumeInfo[]): Promise<void> {
    for (const volume of volumes) {
      const volumeNum = volume.volume.toString().padStart(2, '0');

      // Only add volume number if there are multiple volumes
      const filename = volumes.length === 1
        ? `${this.domainPrefix}_merged.md`
        : `${this.domainPrefix}_merged_${volumeNum}.md`;

      const outputPath = path.join(this.options.outputDir, filename);

      let content = `# Merged Content - Volume ${volumeNum}\n\n`;
      content += `**Pages:** ${volume.pageCount}\n`;
      content += `**Characters:** ${volume.charCount.toLocaleString()}\n\n`;
      content += `---\n\n`;

      // Add separator between pages
      for (let i = 0; i < volume.files.length; i++) {
        const file = volume.files[i];
        const fileContent = await fs.readFile(file, 'utf-8');

        if (i > 0) {
          content += `\n\n${'='.repeat(80)}\n\n`;
        }

        content += fileContent;
      }

      await fs.writeFile(outputPath, content, 'utf-8');

      console.log(
        `💾 Volume ${volumeNum}: ${volume.pageCount} pages, ${volume.charCount.toLocaleString()} chars`
      );
    }
  }

  private async writeManifest(volumes: VolumeInfo[]): Promise<void> {
    const manifestPath = path.join(
      this.options.outputDir,
      `${this.domainPrefix}_manifest.csv`
    );

    const lines = [
      'volume,charCount,pageCount',
      ...volumes.map((v) => `${v.volume},${v.charCount},${v.pageCount}`),
    ];

    // Add UTF-8 BOM for Excel compatibility
    const csvContent = '\uFEFF' + lines.join('\n');
    await fs.writeFile(manifestPath, csvContent, 'utf-8');

    console.log(`\n💾 Saved manifest: ${manifestPath}`);
  }
}
