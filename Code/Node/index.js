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
        win.webContents.executeJavaScript(`
            // todo: make this softcoded
            function randomString(length) {
                var result = '';
                var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                var charactersLength = characters.length;
                for (var i = 0; i < length; i++) {
                    result += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
                return result;
            }
            function dlgb(id) {
                ${fs.readFileSync(__dirname + '/../Web/Download.js')}
            }
            var overrideCSS = document.createElement('style');
            overrideCSS.innerHTML = \`${fs.readFileSync(__dirname + '/../Web/Override.css')}\`
            document.head.appendChild(overrideCSS);

            document.title = 'GameBanana';

            var dragdiv = document.createElement('div');
            dragdiv.id = 'dragdiv';
            document.body.appendChild(dragdiv);

            // todo: hate this code
            setTimeout(() => {
                var obj = document.querySelectorAll('.DownloadOptions .GreenColor');
                console.log(obj);
                var i = -1;
                while (i <= obj.length) {
                    i++;
                    console.log(i, obj[i]);
                    obj[i].id = randomString(10);
                    window[obj[i].id] = obj[i].href;
                    obj[i].href = 'javascript:dlgb("' + obj[i].id + '");';
                }
            }, 1000);
        `);
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