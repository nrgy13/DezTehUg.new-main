import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

/**
 * Конвертация DOCX-буфера в PDF-буфер через LibreOffice headless.
 *
 * Запускает `soffice --headless --convert-to pdf` через child_process в
 * уникальной временной директории (профиль LibreOffice + io). Подходит для
 * запуска в app-контейнере с установленным LibreOffice (см. Dockerfile).
 *
 * Под параллельной нагрузкой каждый вызов получает свой UserInstallation —
 * экземпляры soffice не конфликтуют между собой.
 *
 * Тайм-аут 60 сек (LibreOffice стартует ~3-5 сек первый раз; потом ~1-2 сек на конверсию).
 *
 * Кидает Error с описанием при:
 * - LibreOffice не найден в PATH
 * - non-zero exit code
 * - тайм-аут
 * - PDF не создан
 */
export async function renderDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const sessionId = randomBytes(8).toString('hex');
  const workDir = path.join(tmpdir(), `deztech-pdf-${sessionId}`);
  const profileDir = path.join(tmpdir(), `deztech-lo-profile-${sessionId}`);
  const docxPath = path.join(workDir, 'input.docx');
  const pdfPath = path.join(workDir, 'input.pdf');

  await fs.mkdir(workDir, { recursive: true });
  await fs.mkdir(profileDir, { recursive: true });

  try {
    await fs.writeFile(docxPath, docxBuffer);

    await runLibreOffice(workDir, profileDir, docxPath);

    const pdfBuffer = await fs.readFile(pdfPath);
    return pdfBuffer;
  } finally {
    // Чистим за собой — даже если конверсия упала
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runLibreOffice(outDir: string, profileDir: string, docxPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Используем soffice (linux) или LibreOffice override через env
    const bin = process.env.LIBREOFFICE_BIN ?? 'soffice';

    const child = spawn(
      bin,
      [
        '--headless',
        '--norestore',
        '--nologo',
        '--nodefault',
        `-env:UserInstallation=file://${profileDir.replace(/\\/g, '/')}`,
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        docxPath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('LibreOffice render timed out after 60s'));
    }, 60_000);

    child.on('error', (err) => {
      clearTimeout(timeout);
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            `LibreOffice binary "${bin}" not found in PATH. ` +
              `Install libreoffice or set LIBREOFFICE_BIN env var.`,
          ),
        );
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `LibreOffice exited with code ${code}. stderr: ${stderr.trim() || '(empty)'}`,
          ),
        );
      }
    });
  });
}
