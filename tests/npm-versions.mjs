import semver from "semver";

const REGISTRY_URL = "https://registry.npmjs.org/";

const PACKAGES = [
  "@minecraft/server",
  "@minecraft/server-ui",
  "@minecraft/server-net",
  "@minecraft/server-admin",
  "@minecraft/vanilla-data",
];

function compareSemver(a, b) {
  const va = semver.valid(a);
  const vb = semver.valid(b);
  if (va && vb) return semver.rcompare(va, vb);
  if (va) return -1;
  if (vb) return 1;
  return b.localeCompare(a);
}

function categorizeVersion(version) {
  const parsed = semver.parse(version);
  if (!parsed) return "unknown";
  if (parsed.prerelease.length === 0) return "release";

  const pre = parsed.prerelease.join(".").toLowerCase();

  if (pre.includes("preview") && pre.includes("beta")) return "preview-beta";
  if (pre.includes("stable") && pre.includes("beta")) return "stable-beta";
  if (pre.includes("beta")) return "beta";
  if (pre.includes("rc")) return "rc";
  if (pre.includes("preview")) return "preview";
  if (pre.includes("alpha")) return "alpha";
  return "other-pre";
}

async function fetchPackageVersions(pkgName) {
  const res = await fetch(`${REGISTRY_URL}${encodeURIComponent(pkgName)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${pkgName}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const versions = Object.keys(data.versions ?? {});
  return versions.sort(compareSemver);
}

function summarizeByCategory(versions) {
  const buckets = new Map();
  for (const version of versions) {
    const category = categorizeVersion(version);
    if (!buckets.has(category)) {
      buckets.set(category, []);
    }
    buckets.get(category).push(version);
  }

  const ordered = Array.from(buckets.entries()).sort((a, b) => {
    const order = [
      "release",
      "stable-beta",
      "preview-beta",
      "beta",
      "rc",
      "preview",
      "alpha",
      "other-pre",
      "unknown",
    ];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  });

  return ordered.map(([category, list]) => ({
    category,
    count: list.length,
    latest: list.slice(0, 5),
  }));
}

async function main() {
  for (const pkg of PACKAGES) {
    console.log(`\n## ${pkg}`);
    const versions = await fetchPackageVersions(pkg);
    console.log(`Total versions: ${versions.length}`);

    const summary = summarizeByCategory(versions);
    for (const item of summary) {
      console.log(
        `- ${item.category}: ${item.count} (latest: ${item.latest.join(", ")})`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
