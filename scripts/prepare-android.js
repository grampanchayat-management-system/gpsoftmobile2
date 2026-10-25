// "npx cap add android" नंतर चालतो: आपला Java कोड, आयकॉन, versionCode टाकतो.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const appDir = path.join(root, 'android', 'app', 'src', 'main');

// 1) Java (MainActivity + GPPrintPlugin)
const javaDir = path.join(appDir, 'java', ...cfg.appId.split('.'));
if (!fs.existsSync(javaDir)) throw new Error('Java folder सापडला नाही: ' + javaDir);
for (const f of fs.readdirSync(path.join(root, 'overlay'))) {
  fs.copyFileSync(path.join(root, 'overlay', f), path.join(javaDir, f));
  console.log('[prepare] copied', f);
}

// 2) आयकॉन (जुने PNG आयकॉन वापरण्यासाठी adaptive-icon xml काढतो)
const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, px] of Object.entries(sizes)) {
  const src = path.join(root, 'icons-android', 'ic_launcher-' + px + '.png');
  const dir = path.join(appDir, 'res', 'mipmap-' + d);
  fs.mkdirSync(dir, { recursive: true });
  for (const n of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) fs.copyFileSync(src, path.join(dir, n));
}
const any = path.join(appDir, 'res', 'mipmap-anydpi-v26');
if (fs.existsSync(any)) fs.rmSync(any, { recursive: true, force: true });

// 3) versionCode = GitHub run number (प्रत्येक नवा APK जुन्यावर अपडेट होण्यासाठी वाढता आकडा)
const gradle = path.join(root, 'android', 'app', 'build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
const vc = process.env.GITHUB_RUN_NUMBER || '1';
const vn = '1.0.' + vc;
if (!/versionCode\s+\d+/.test(g)) throw new Error('build.gradle मध्ये versionCode सापडला नाही');
g = g.replace(/versionCode\s+\d+/, 'versionCode ' + vc).replace(/versionName\s+"[^"]*"/, 'versionName "' + vn + '"');
fs.writeFileSync(gradle, g);
console.log('[prepare] versionCode', vc, 'versionName', vn);
