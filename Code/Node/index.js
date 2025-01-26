const { app, BrowserWindow, dialog, ipcMain, Notification, Tray, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

var MINUTES = 4;

function updateInterval() {
    fs.writeFileSync(app.getPath('appData') + '/interval', MINUTES.toString());
}

if (fs.existsSync(app.getPath('appData') + '/interval', 'utf8')) {
    MINUTES = parseInt(fs.readFileSync(app.getPath('appData') + '/interval', 'utf8'));
}
else {
    MINUTES = 5;
    updateInterval();
}


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

    win.on('close', (event) => {
        if (!fs.existsSync(app.getPath('appData') + '/noBG', 'utf8')) {
            event.preventDefault();
            win.hide();

            if (MINUTES != -1) {
                setInterval(() => {
                    checkForNotifications(win);
                }, 1000 * 60 * MINUTES);
            }
        }
    });

    ipcMain.on('settings', () => {
        var modal = new BrowserWindow({
            parent: win,
            modal: true,
            width: 900,
            height: 700,
            title: 'Settings',
            webPreferences: {
                nodeIntegration: true,
                preload: __dirname + '/../Web/settingsIPC.js'
            }
        });
        modal.loadFile(__dirname + '/../Web/settings.html');
        modal.webContents.on('did-finish-load', () => {
            modal.webContents.executeJavaScript('receiveSettings({frequency: ' + MINUTES + ', background: ' + !fs.existsSync(app.getPath('appData') + '/noBG', 'utf8') + '})');
        });
        ipcMain.on('sendSettings', (event, data) => {
            MINUTES = data.frequency;
            if (data.background) {
                if (fs.existsSync(app.getPath('appData') + '/noBG', 'utf8')) {
                    fs.unlinkSync(app.getPath('appData') + '/noBG');
                }
            }
            else {
                fs.writeFileSync(app.getPath('appData') + '/noBG', 'true');
            }

            updateInterval();

            dialog.showMessageBox({
                title: 'GameBanana',
                message: 'Settings saved successfully! To apply changes, restart the app.',
                type: 'info'
            }).then(() => {
                modal.close();
            });
        });
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

        if (url.includes('members/settings/')) {
            console.log('Injecting settings');
            setTimeout(() => {
                win.webContents.executeJavaScript(`
                    var cc = document.querySelector('module#SettingsPortalModule .Content');
                    cc.innerHTML += \`<div class="CategoryTitle">GameDesktop specific settings</div><p style="width: 100% !important"><spriteicon class="SettingsIcon AdditionalDetailsIcon" style="margin-right: 10px"></spriteicon>This section is exclusive to GameDesktop.</p><br><a href="javascript:window.electronAPI.settings()"><spriteicon class="SettingsIcon AppsIcon"></spriteicon><div><div class=\"Cluster\"><span>Settings</span><!--v-if--><!--v-if--></div><p>Settings for this app</p></div></a>\`;
                `);
            }, 2000);
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
    if (fs.existsSync(app.getPath('appData') + '/noBG', 'utf8')) {
        app.quit();
    }
});