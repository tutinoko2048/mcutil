import semver from 'semver';

export interface PackageInfo<C extends string[] = string[]> {
  name: string;
  dev: boolean;
  categories: C;
  categorize?: (version: string) => C[number];
  exclude?: (version: string) => boolean;
}

function definePackage<const C extends string[]>(name: string, info: Omit<PackageInfo<C>, 'name'>) {
  return { name, ...info };
}

export const PACKAGES = [
  definePackage('@minecraft/server', {
    dev: true,
    categories: ['release', 'stable-beta', 'preview-beta', 'preview-rc'],
    exclude: (v) => v.includes('internal'),
  }),
  definePackage('@minecraft/server-ui', {
    dev: true,
    categories: ['release', 'stable-beta', 'preview-beta', 'preview-rc'],
    exclude: (v) => v.includes('internal'),
  }),
  definePackage('@minecraft/server-net', {
    dev: true,
    categories: ['release', 'stable-beta', 'preview-beta', 'preview-rc'],
  }),
  definePackage('@minecraft/server-admin', {
    dev: true,
    categories: ['release', 'stable-beta', 'preview-beta', 'preview-rc'],
  }),
  definePackage('@minecraft/diagnostics', {
    dev: true,
    categories: ['release', 'stable-beta', 'preview-beta', 'preview-rc'],
  }),
  definePackage('@minecraft/vanilla-data', {
    dev: false,
    categories: ['stable', 'preview'],
    categorize: categorizeVanillaDataVersion,
  }),
  definePackage('@minecraft/server-gametest', {
    dev: true,
    categories: ['release', 'stable-beta', 'preview-beta', 'preview-rc'],
    exclude: (v) => v.includes('internal'),
  }),
];

export function categorizeVersion(
  version: string,
): 'release' | 'stable-beta' | 'preview-beta' | 'preview-rc' {
  const parsed = semver.parse(version);
  if (!parsed) throw new Error(`Invalid version: ${version}`);

  if (parsed.prerelease.length === 0) return 'release';

  const pre = parsed.prerelease.join('.').toLowerCase();
  if (pre.includes('preview') && pre.startsWith('rc')) return 'preview-rc';
  // 1.0.0-preview.1.19.60.22 is rc
  if (pre.startsWith('preview') && !pre.includes('beta')) return 'preview-rc';
  if (pre.includes('preview')) return 'preview-beta';
  if (pre.startsWith('beta')) return 'stable-beta';

  throw new Error(`Unhandled version: ${version}`);
}

function categorizeVanillaDataVersion(version: string): 'stable' | 'preview' {
  if (!version.includes('preview')) return 'stable';
  return 'preview';
}
