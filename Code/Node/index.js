const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
function createWindow () {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: 'rgb(28,39,46)',
            symbolColor: 'rgb(255, 255, 255)',
            height: 68
        },
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.setMenuBarVisibility(false);

    win.loadURL('https://gamebanana.com/');

    win.setIcon(__dirname + '/../Web/banana.png');

    win.webContents.on('did-finish-load', () => {
        win.webContents.executeJavaScript(fs.readFileSync(__dirname + '/../Web/OnLoad.js', 'utf8').replace('$CSS$', fs.readFileSync(__dirname + '/../Web/Override.css', 'utf8')));
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });

    win.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        require('electron').shell.openExternal(url);
    });

    win.webContents.on('did-navigate', (event, url) => {
        if (!url.includes('gamebanana.com')) {
            event.preventDefault();
            require('electron').shell.openExternal(url);
            win.webContents.executeJavaScript('window.history.back()');
        }

        if (url.includes('trash')) {
            dialog.showMessageBox(win, {
                type: 'warning',
                title: 'Admin Permissions Required',
                message: 'To perform this action, you will need elevated privileges from your host system.\nPlease allow the prompt that appears shortly.',
            }).then(function() {
                var elevate = require('windows-elevate');

                elevate.exec('echo', 'Admin perms test', function(error, stdout, stderror) {
                    if (error) {
                        console.error('Failed!');
                        win.webContents.executeJavaScript('window.history.back()');
                        return;
                    }

                    console.log('Success!');
                });
            });
        }
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