import fs from 'fs';
import path from 'path';

const origPath = 'E:\\CV-analyzer-light\\src';
const testPath = 'E:\\CV-analyzer-light - test 1\\src';

const origFiles = fs.readdirSync(origPath);
const testFiles = fs.readdirSync(testPath);

console.log('Orig files in src:', origFiles);
console.log('Test files in src:', testFiles);

// Compare view files
const viewsOrig = fs.readdirSync(path.join(origPath, 'views'));
const viewsTest = fs.readdirSync(path.join(testPath, 'views'));

console.log('\nOrig views:', viewsOrig);
console.log('Test views:', viewsTest);

viewsOrig.forEach(v => {
  const pOrig = path.join(origPath, 'views', v);
  const pTest = path.join(testPath, 'views', v);
  if (fs.existsSync(pOrig) && fs.existsSync(pTest)) {
    const sOrig = fs.statSync(pOrig).size;
    const sTest = fs.statSync(pTest).size;
    console.log(`View ${v}: Orig size=${sOrig}, Test size=${sTest}`);
  }
});
