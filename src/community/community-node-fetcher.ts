import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Strapi API response types for verified community nodes
 */
export interface StrapiCommunityNodeAttributes {
  name: string;
  displayName: string;
  description: string;
  packageName: string;
  authorName: string;
  authorGithubUrl?: string;
  npmVersion: string;
  numberOfDownloads: number;
  numberOfStars: number;
  isOfficialNode: boolean;
  isPublished: boolean;
  nodeDescription: any; // Complete n8n node schema
  nodeVersions?: any[];
  checksum?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrapiCommunityNode {
  id: number;
  attributes: StrapiCommunityNodeAttributes;
}

export interface StrapiPaginatedResponse<T> {
  data: Array<{ id: number; attributes: T }>;
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

/**
 * npm registry search response types
 */
export interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  date: string;
  links: {
    npm: string;
    homepage?: string;
    repository?: string;
  };
  author?: {
    name?: string;
    email?: string;
    username?: string;
  };
  publisher?: {
    username: string;
    email: string;
  };
  maintainers: Array<{ username: string; email: string }>;
}

export interface NpmSearchResult {
  package: NpmPackageInfo;
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore: number;
}

export interface NpmSearchResponse {
  objects: NpmSearchResult[];
  total: number;
  time: string;
}

/**
 * Fetches community nodes from n8n Strapi API and npm registry.
 * Follows the pattern from template-fetcher.ts.
 */
export class CommunityNodeFetcher {
  private readonly strapiBaseUrl: string;
  private readonly npmSearchUrl = 'https://registry.npmjs.org/-/v1/search';
  private readonly npmRegistryUrl = 'https://registry.npmjs.org';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second base delay
  private readonly strapiPageSize = 25;
  private readonly npmPageSize = 250; // npm API max

  constructor(environment: 'production' | 'staging' = 'production') {
    this.strapiBaseUrl =
      environment === 'production'
        ? 'https://api.n8n.io/api/community-nodes'
        : 'https://api-staging.n8n.io/api/community-nodes';
  }

  /**
   * Retry helper for API calls (same pattern as TemplateFetcher)
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    context: string,
    maxRetries: number = this.maxRetries
  ): Promise<T | null> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          logger.warn(
            `${context} - Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    logger.error(`${context} - All ${maxRetries} attempts failed, skipping`, lastError);
    return null;
  }

  /**
   * Fetch all verified community nodes from n8n Strapi API.
   * These nodes include full nodeDescription schemas - no parsing needed!
   */
  async fetchVerifiedNodes(
    progressCallback?: (message: string, current: number, total: number) => void
  ): Promise<StrapiCommunityNode[]> {
    const allNodes: StrapiCommunityNode[] = [];
    let page = 1;
    let hasMore = true;
    let total = 0;

    logger.info('Fetching verified community nodes from n8n Strapi API...');

    while (hasMore) {
      const result = await this.retryWithBackoff(
        async () => {
          const response = await axios.get<StrapiPaginatedResponse<StrapiCommunityNodeAttributes>>(
            this.strapiBaseUrl,
            {
              params: {
                'pagination[page]': page,
                'pagination[pageSize]': this.strapiPageSize,
              },
              timeout: 30000,
            }
          );
          return response.data;
        },
        `Fetching verified nodes page ${page}`
      );

      if (result === null) {
        logger.warn(`Skipping page ${page} after failed attempts`);
        page++;
        continue;
      }

      const nodes = result.data.map((item) => ({
        id: item.id,
        attributes: item.attributes,
      }));

      allNodes.push(...nodes);
      total = result.meta.pagination.total;

      if (progressCallback) {
        progressCallback(`Fetching verified nodes`, allNodes.length, total);
      }

      logger.debug(
        `Fetched page ${page}/${result.meta.pagination.pageCount}: ${nodes.length} nodes (total: ${allNodes.length}/${total})`
      );

      // Check if there are more pages
      if (page >= result.meta.pagination.pageCount) {
        hasMore = false;
      }

      page++;

      // Rate limiting
      if (hasMore) {
        await this.sleep(300);
      }
    }

    logger.info(`Fetched ${allNodes.length} verified community nodes from Strapi API`);
    return allNodes;
  }

  /**
   * Fetch popular community node packages from npm registry.
   * Sorted by popularity (downloads). Returns package metadata only.
   * To get node schemas, packages need to be downloaded and parsed.
   *
   * @param limit Maximum number of packages to fetch (default: 100)
   */
  async fetchNpmPackages(
    limit: number = 100,
    progressCallback?: (message: string, current: number, total: number) => void
  ): Promise<NpmSearchResult[]> {
    const allPackages: NpmSearchResult[] = [];
    let offset = 0;
    const targetLimit = Math.min(limit, 1000); // npm API practical limit

    logger.info(`Fetching top ${targetLimit} community node packages from npm registry...`);

    while (allPackages.length < targetLimit) {
      const remaining = targetLimit - allPackages.length;
      const size = Math.min(this.npmPageSize, remaining);

      const result = await this.retryWithBackoff(
        async () => {
          const response = await axios.get<NpmSearchResponse>(this.npmSearchUrl, {
            params: {
              text: 'keywords:n8n-community-node-package',
              size,
              from: offset,
              // Sort by popularity (downloads)
              quality: 0,
              popularity: 1,
              maintenance: 0,
            },
            timeout: 30000,
          });
          return response.data;
        },
        `Fetching npm packages (offset ${offset})`
      );

      if (result === null) {
        logger.warn(`Skipping npm fetch at offset ${offset} after failed attempts`);
        break;
      }

      if (result.objects.length === 0) {
        break; // No more packages
      }

      allPackages.push(...result.objects);

      if (progressCallback) {
        progressCallback(`Fetching npm packages`, allPackages.length, Math.min(result.total, targetLimit));
      }

      logger.debug(
        `Fetched ${result.objects.length} packages (total: ${allPackages.length}/${Math.min(result.total, targetLimit)})`
      );

      offset += size;

      // Rate limiting
      await this.sleep(300);
    }

    // Sort by popularity score (highest first)
    allPackages.sort((a, b) => b.score.detail.popularity - a.score.detail.popularity);

    logger.info(`Fetched ${allPackages.length} community node packages from npm`);
    return allPackages.slice(0, limit);
  }

  /**
   * Fetch package.json for a specific npm package to get the n8n node configuration.
   */
  async fetchPackageJson(packageName: string, version?: string): Promise<any | null> {
    const url = version
      ? `${this.npmRegistryUrl}/${packageName}/${version}`
      : `${this.npmRegistryUrl}/${packageName}/latest`;

    return this.retryWithBackoff(
      async () => {
        const response = await axios.get(url, { timeout: 15000 });
        return response.data;
      },
      `Fetching package.json for ${packageName}${version ? `@${version}` : ''}`
    );
  }

  /**
   * Download package tarball URL for a specific package version.
   * Returns the tarball URL that can be used to download and extract the package.
   */
  async getPackageTarballUrl(packageName: string, version?: string): Promise<string | null> {
    const packageJson = await this.fetchPackageJson(packageName, version);

    if (!packageJson) {
      return null;
    }

    // For specific version fetch, dist.tarball is directly available
    if (packageJson.dist?.tarball) {
      return packageJson.dist.tarball;
    }

    // For full package fetch, get the latest version's tarball
    const latestVersion = packageJson['dist-tags']?.latest;
    if (latestVersion && packageJson.versions?.[latestVersion]?.dist?.tarball) {
      return packageJson.versions[latestVersion].dist.tarball;
    }

    return null;
  }

  /**
   * Get download statistics for a package from npm.
   */
  async getPackageDownloads(
    packageName: string,
    period: 'last-week' | 'last-month' = 'last-week'
  ): Promise<number | null> {
    return this.retryWithBackoff(
      async () => {
        const response = await axios.get(
          `https://api.npmjs.org/downloads/point/${period}/${packageName}`,
          { timeout: 10000 }
        );
        return response.data.downloads;
      },
      `Fetching downloads for ${packageName}`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
