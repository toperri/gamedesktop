const { app, BrowserWindow, dialog, ipcMain, Notification, Tray, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

var __fabCallback = null;
var win = null;
var tray = null;

function createAppBarIcon(win) {
    if (tray) {
        tray.destroy();
    }

    tray = new Tray(path.join(__dirname, '/../Web/banana.png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show app', click: () => {
                win.show();
            }
        },
        {
            label: 'Disable background mode', click: () => {
                fs.writeFileSync(app.getPath('appData') + '/noBG', 'true');
                dialog.showMessageBox({
                    title: 'GameBanana',
                    message: 'Background mode has been disabled. Quit the app to apply changes.',
                    type: 'info'
                });
            }, visible: !fs.existsSync(app.getPath('appData') + '/noBG', 'utf8')
        },
        {
            label: 'Enable background mode', click: () => {
                fs.unlinkSync(app.getPath('appData') + '/noBG');
                dialog.showMessageBox({
                    title: 'GameBanana',
                    message: 'Background mode has been enabled. Quit the app to apply changes.',
                    type: 'info'
                });
            }, visible: fs.existsSync(app.getPath('appData') + '/noBG', 'utf8')
        },
        {
            label: 'Quit', click: () => {
                win.webContents.executeJavaScript('close = true; window.close();');
                setTimeout(() => {
                    win.close();
                    process.exit(0);
                }, 1000);
            }
        }
    ]);

    tray.setToolTip('GameBanana');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        win.isVisible() ? win.hide() : win.show();
    });
}

function fab(win, url) {
    return new Promise((resolve, reject) => {
        __fabCallback = (content) => {
            resolve(content);
            __fabCallback = null;
        };
        win.webContents.executeJavaScript(fs.readFileSync(__dirname + '/../Web/FAB.js', 'utf8').replace('{URL}', url));
    });
}

function checkForNotifications(win) {
    fab(win, "https://gamebanana.com/apiv11/Member/PersonalNotifications?_nPage=1").then((content) => {
        var json = JSON.parse(content);
        if (json._sErrorCode) {
            return;
        }
        var count = 0;
        json._aRecords.forEach((notif) => {
            if (notif._bIsSeen) {
                return;
            }
            count++;
        });
        var firstNotif = json._aRecords[0]._aNotifications.map(obj => obj._sSentence)[0];
        firstNotif = firstNotif.replace(/<[^>]*>/g, '');
        if (count > 0) {
            var notification = new Notification({
                title: count + ' unread notifications!',
                body: firstNotif + "...",
                icon: __dirname + '/../Web/banana.png',
                click: () => {
                    win.show();
                    win.webContents.executeJavaScript('document.getElementById("notifications").click()');
                }
            });
            notification.show();
        }
    });
}

function createWindow () {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: 'rgb(28,39,46)',
            symbolColor: 'rgb(255, 255, 255)',
            height: 68
        },
        webPreferences: {
            nodeIntegration: true,
            preload: __dirname + '/../Web/ElectronIPC.js'
        }
    });

    createAppBarIcon(win);

    win.setMenuBarVisibility(false);

    win.loadURL('https://gamebanana.com/');

    win.setIcon(__dirname + '/../Web/banana.png');

    ipcMain.on('_fabCallback', (event, content) => {
        if (__fabCallback) {
            __fabCallback(content);
        }
    });

    win.webContents.on('did-finish-load', () => {
        win.webContents.executeJavaScript(fs.readFileSync(__dirname + '/../Web/OnLoad.js', 'utf8').replace('$CSS$', fs.readFileSync(__dirname + '/../Web/Override.css', 'utf8')));

        console.log('Page loaded!');
        checkForNotifications(win);
    });

    ipcMain.on('hide', () => {
        if (fs.existsSync(app.getPath('appData') + '/noBG', 'utf8')) {
            win.hide();
            win.webContents.executeJavaScript('close = true; window.close();');
            setTimeout(() => {
                win.close();
                process.exit(0);
            }, 1000);
            return;
        }
        win.hide();
        if (!fs.existsSync(app.getPath('appData') + '/firstRun', 'utf8')) {
            var notification = new Notification({
                title: 'GameBanana',
                body: 'The app runs in the background. Click for more info.',
                icon: __dirname + '/../Web/banana.png'
            });

            notification.once('click', () => {
                dialog.showMessageBox({
                    title: 'GameBanana',
                    message: 'The app is still running in the background. Would you like to close it?',
                    type: 'info',
                    buttons: ['Yes', 'No', 'Disable background mode']
                }).then((result) => {
                    if (result.response === 1) {
                        win.webContents.executeJavaScript('close = true; window.close();');
                        setTimeout(() => {
                            win.close();
                            process.exit(0);
                        }, 1000);
                    }
                    if (result.response === 2) {
                        win.webContents.executeJavaScript('close = true; window.close();');
                        setTimeout(() => {
                            win.close();
                            process.exit(0);
                        }, 1000);
                        fs.writeFileSync(app.getPath('appData') + '/noBG', 'true');
                    }
                });
            });

            notification.show();

            fs.writeFileSync(app.getPath('appData') + '/firstRun', 'true');
        }
        setInterval(() => {
            win.webContents.executeJavaScript(fs.readFileSync(__dirname + '/../Web/OnLoad.js', 'utf8').replace('$CSS$', fs.readFileSync(__dirname + '/../Web/Override.css', 'utf8')));

            console.log('Page loaded!');
            checkForNotifications(win);
        }, 1000 * 60);
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

        if (url.includes('trash') || url.includes('settings/password/')) {
            win.hide();
            dialog.showMessageBox({
                type: 'warning',
                title: 'Elevated action warning',
                message: 'This page requires elevated permissions. Windows will ask you admin permissions to continue.',
            }).then(function() {
                var elevate = require('windows-elevate');

                elevate.exec('echo', 'Admin perms test', function(error, stdout, stderror) {
                    if (error) {
                        console.error('Failed!');
                        win.show();
                        win.webContents.executeJavaScript('window.history.back()');
                        return;
                    }

                    win.show();
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