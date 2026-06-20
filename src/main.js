const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const CURRENT_VERSION = app.getVersion();
const REPO_OWNER = '3679973612';
const REPO_NAME = 'JO-videos';

// Fix ffmpeg path for packaged app (asar -> asar.unpacked)
function resolveFfmpegPath(p) {
  if (!p) return p;
  if (p.includes('app.asar')) {
    return p.replace('app.asar', 'app.asar.unpacked');
  }
  return p;
}
const ffmpegBin = resolveFfmpegPath(ffmpegPath);
console.log('[ffmpeg] path:', ffmpegBin, 'exists:', fs.existsSync(ffmpegBin));

let mainWindow;
let selectedSourceId = null;
let customOutputDir = null;
let hideFromCapture = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 220, minWidth: 1000, minHeight: 200, maxHeight: 270,
    frame: false, transparent: true, backgroundColor: '#00000000',
    resizable: true, alwaysOnTop: true, skipTaskbar: false,
    title: 'JO videos',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async (_r, cb) => {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
    const chosen = sources.find(s => s.id === selectedSourceId) || sources[0];
    cb({ video: chosen, audio: false });
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.handle('window:close', () => mainWindow && mainWindow.close());

ipcMain.handle('window:set-hide-on-record', (_e, enabled) => {
  hideFromCapture = !!enabled;
  return true;
});

ipcMain.handle('recording:started', () => {
  if (hideFromCapture && mainWindow) {
    mainWindow.setContentProtection(true);
  }
  return true;
});

ipcMain.handle('recording:stopped', () => {
  if (mainWindow) {
    mainWindow.setContentProtection(false);
  }
  return true;
});

ipcMain.handle('sources:list', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
  return sources.map(s => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() }));
});

ipcMain.handle('source:select', async (_e, sid) => { selectedSourceId = sid; return true; });

ipcMain.handle('output:choose-dir', async () => {
  const r = await dialog.showOpenDialog({ title: '选择保存目录', properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths.length) return { canceled: true, path: customOutputDir };
  customOutputDir = r.filePaths[0];
  return { canceled: false, path: customOutputDir };
});

ipcMain.handle('output:get-dir', async () => ({ path: customOutputDir || app.getPath('videos') }));

ipcMain.handle('recording:save', async (_e, { base64, fileName }) => {
  const defaultDir = customOutputDir || app.getPath('videos');
  const defaultPath = path.join(defaultDir, fileName);
  const r = await dialog.showSaveDialog({
    title: '保存录制', defaultPath,
    filters: [{ name: 'MP4 视频', extensions: ['mp4'] }]
  });
  if (r.canceled || !r.filePath) return { canceled: true };

  const tempWebm = path.join(os.tmpdir(), Date.now() + '-' + path.basename(fileName, '.mp4') + '.webm');
  const buf = Buffer.from(base64, 'base64');
  console.log('[save] writing temp webm:', tempWebm, 'size:', buf.length);
  fs.writeFileSync(tempWebm, buf);
  console.log('[save] temp webm written OK');
  return { canceled: false, filePath: r.filePath, tempInputPath: tempWebm };
});

ipcMain.handle('recording:transcode', async (_e, { inputPath, outputPath }) => {
  console.log('[transcode] input:', inputPath, 'output:', outputPath);
  console.log('[transcode] ffmpeg:', ffmpegBin);
  console.log('[transcode] input exists:', fs.existsSync(inputPath));
  const tempMp4 = path.join(os.tmpdir(), Date.now() + '-out.mp4');
  try {
    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegBin, [
        '-y', '-i', inputPath,
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', tempMp4
      ], { windowsHide: true });
      let err = '';
      ff.stderr.on('data', c => err += c.toString());
      ff.on('error', (e) => { console.error('[transcode] spawn error:', e); reject(e); });
      ff.on('close', code => {
        console.log('[transcode] ffmpeg exit code:', code);
        if (code === 0) resolve();
        else { console.error('[transcode] ffmpeg stderr:', err.slice(-500)); reject(new Error(err || 'ffmpeg code ' + code)); }
      });
    });
  } catch (e) {
    console.error('[transcode] failed:', e.message);
    throw e;
  }

  try {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    fs.copyFileSync(tempMp4, outputPath);
    fs.unlinkSync(tempMp4);
  } catch (_) { /* best-effort */ }
  try { fs.unlinkSync(inputPath); } catch (_) {}

  return { ok: true, outputPath };
});

ipcMain.handle('file:show', async (_e, fp) => { if (!fp) return false; await shell.showItemInFolder(fp); return true; });

// --- Auto Update ---
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'JO-videos' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function httpsDownload(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'JO-videos' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlinkSync(dest);
        return httpsDownload(res.headers.location, dest).then(resolve, reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    }).on('error', e => { file.close(); fs.unlinkSync(dest); reject(e); });
  });
}

ipcMain.handle('update:check', async () => {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
    const raw = await httpsGet(url);
    const releases = JSON.parse(raw);
    const latest = releases[0];
    if (!latest) return { hasUpdate: false, error: '无发布版本' };
    const latestVer = (latest.tag_name || '').replace(/^v/i, '');
    const hasUpdate = latestVer !== CURRENT_VERSION;
    return {
      hasUpdate,
      current: CURRENT_VERSION,
      latest: latestVer,
      name: latest.name || latest.tag_name,
      body: latest.body || '',
      assets: (latest.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })),
      versions: releases.map(r => ({
        tag: r.tag_name,
        name: r.name || r.tag_name,
        body: r.body || '',
        date: r.published_at,
        assets: (r.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size }))
      }))
    };
  } catch (e) {
    console.error('[update] check failed:', e.message);
    return { hasUpdate: false, error: e.message };
  }
});

ipcMain.handle('update:download', async (event, { url, fileName }) => {
  const dest = path.join(os.tmpdir(), fileName || 'JO-videos-Setup.exe');
  try {
    console.log('[update] downloading:', url);
    await httpsDownload(url, dest);
    console.log('[update] downloaded to:', dest);
    spawn(dest, [], { detached: true, stdio: 'ignore' }).unref();
    app.quit();
    return { ok: true };
  } catch (e) {
    console.error('[update] download failed:', e.message);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('app:version', () => CURRENT_VERSION);
