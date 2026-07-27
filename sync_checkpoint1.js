import fs from 'fs';
import path from 'path';

const srcRoot = 'E:\\CV-analyzer-light';
const destRoot = 'E:\\CV-analyzer-light - test 1';

function syncDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);
  for (const item of items) {
    if (item === 'node_modules' || item === 'dist' || item === '.git' || item === 'check_history.js' || item === 'extract_checkpoint1_files.js' || item === 'compare_repos.js' || item === 'sync_checkpoint1.js') {
      continue;
    }

    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      syncDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`Synced: ${item} (${stat.size} bytes) -> ${destPath}`);
    }
  }
}

// Perform complete sync from E:\CV-analyzer-light to E:\CV-analyzer-light - test 1
syncDirectory(path.join(srcRoot, 'src'), path.join(destRoot, 'src'));
if (fs.existsSync(path.join(srcRoot, 'server.ts'))) {
  fs.copyFileSync(path.join(srcRoot, 'server.ts'), path.join(destRoot, 'server.ts'));
  console.log('Synced server.ts');
}

// Clean up any redesign components created in test 1
const redesignExtraFiles = [
  path.join(destRoot, 'src', 'components', 'NavRail.tsx'),
  path.join(destRoot, 'src', 'components', 'AppearancePopover.tsx'),
  path.join(destRoot, 'src', 'context', 'ThemeContext.tsx')
];

redesignExtraFiles.forEach(f => {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log('Deleted extra redesign file:', f);
  }
});

console.log('\n--- Sync Complete ---');
