import { execFileSync } from 'node:child_process';
try {
  const languages=execFileSync('tesseract',['--list-langs'],{encoding:'utf8',timeout:10000});
  if(!/^ara\s*$/m.test(languages)||!/^eng\s*$/m.test(languages)) throw new Error('Install both Arabic (ara) and English (eng) language packs.');
  for(const command of ['pdfinfo','pdftoppm']) execFileSync(command,['-v'],{stdio:'pipe',timeout:10000});
  console.log('Local OCR ready: Tesseract ara+eng and Poppler detected.');
} catch(error) {
  console.error('Local OCR unavailable:',error.message);
  console.error('See README > Local OCR setup. Text-based CV analysis remains available.');
  process.exitCode=1;
}
