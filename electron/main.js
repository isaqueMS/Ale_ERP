const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'logo.ico');
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Estudio Alê - ERP Premium",
    frame: true,
    backgroundColor: '#0f0f0f',
    show: true,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Necessário para carregar assets locais via file://
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Remove o menu padrão para visual limpo
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:3377');
    win.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadFile(indexPath).catch((err) => {
      console.error('Erro ao carregar index.html:', err);
      const asarPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html');
      win.loadFile(asarPath).catch(console.error);
    });
  }

  // Abrir links externos no navegador padrão do usuário
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Log de erros de carregamento para debug
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Falha ao carregar: ${validatedURL} (Erro: ${errorDescription})`);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
