import semver from 'semver';

export async function fetchPackageVersions(pkgName: string): Promise<string[]> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${pkgName}: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { versions?: Record<string, unknown> };
  return Object.keys(data.versions ?? {});
}

export function compareVersion(a: string, b: string): number {
  const parsedA = semver.parse(a);
  const parsedB = semver.parse(b);

  if (!parsedA || !parsedB) throw new Error(`Invalid version(s): ${a}, ${b}`);

  const preA = parsedA.prerelease.join('.').toLowerCase();
  if (preA) {
    // 1.0.0-beta.release.1.19.50
    if (preA.startsWith('beta.release')) return 1;
    // 1.0.0-beta.11940b23
    if (preA.match(/beta\..{8}/)) return 1;
  }

  const preB = parsedB.prerelease.join('.').toLowerCase();
  if (preB) {
    // 1.0.0-beta.release.1.19.50
    if (preB.startsWith('beta.release')) return -1;
    // 1.0.0-beta.11940b23
    if (preB.match(/beta\..{8}/)) return -1;
  }

  return semver.compare(a, b);
}
