// Bumps the Android version in android/version.properties.
//
//   npm run android:version -- patch     1.0.0 -> 1.0.1
//   npm run android:version -- minor     1.0.1 -> 1.1.0
//   npm run android:version -- major     1.1.0 -> 2.0.0
//   npm run android:version -- 1.4.2     set the version name explicitly
//   npm run android:version              only show the current version
//
// versionCode (what Google Play compares - it must go up with every upload)
// is increased by one whenever the version name is changed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../android/version.properties', import.meta.url));
const text = readFileSync(file, 'utf8');
const versionCode = parseInt(text.match(/^versionCode=(\d+)$/m)?.[1] ?? '', 10);
const versionName = text.match(/^versionName=(\d+)\.(\d+)\.(\d+)$/m);
if (!Number.isInteger(versionCode) || !versionName) {
  console.error(`${file} needs "versionCode=<number>" and "versionName=<major.minor.patch>" lines.`);
  process.exit(1);
}

const [major, minor, patch] = versionName.slice(1).map(Number);
const current = `${major}.${minor}.${patch}`;
const request = process.argv[2];

let next;
if (request === undefined) {
  console.log(`versionName ${current}, versionCode ${versionCode}`);
  process.exit(0);
} else if (request === 'patch') {
  next = `${major}.${minor}.${patch + 1}`;
} else if (request === 'minor') {
  next = `${major}.${minor + 1}.0`;
} else if (request === 'major') {
  next = `${major + 1}.0.0`;
} else if (/^\d+\.\d+\.\d+$/.test(request)) {
  next = request;
} else {
  console.error('Usage: npm run android:version -- <patch|minor|major|x.y.z>');
  process.exit(1);
}

writeFileSync(file, `versionCode=${versionCode + 1}\nversionName=${next}\n`);
console.log(`versionName ${current} -> ${next}, versionCode ${versionCode} -> ${versionCode + 1}`);
