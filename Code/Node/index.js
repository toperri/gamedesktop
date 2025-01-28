const { app, BrowserWindow, dialog, ipcMain, Notification, Tray, Menu, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
var request = require('request');
var progress = require('request-progress');

var MINUTES = 4;
var url = '';
var checkedNotifs = false;

process.on('uncaughtException', (err) => {
    console.error(err);
    dialog.showErrorBox('gamedesktop', 'An error occurred. Please check the console for more information.');
});

function windowOpt(opt) {
    return {
        width: opt.width || 800,
        height: opt.height || 600,
        titleBarStyle: opt.titleBarStyle || 'default',
        titleBarOverlay: opt.titleBarOverlay || {},
        webPreferences: opt.webPreferences || { nodeIntegration: false },
        parent: opt.parent || null,
        modal: opt.modal || false,
        title: opt.title || 'Untitled'
    };
}
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

let setup2FA = false;

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
                process.exit();
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
                }
            });
            notification.show();
        }
    });
}

function createWindow () {
    axios.get('https://gamebanana.com/apiv11/Tool/18841/Updates?_nPage=1&_nPerPage=10')
        .then(response => {
            var versions = response.data._aRecords.map(x => x._sVersion);

            var myVersion = JSON.parse(fs.readFileSync(__dirname + '/../../package.json', 'utf8')).version.substr(0, 3);

            console.log('Versions:', versions);
            console.log('My version:', myVersion);

            if (versions[0] != myVersion) {
                var ba = ['OK'];
                console.log(process.argv);
                if (process.argv.includes('--ignore-update')) {
                    ba.push('Ignore');
                }
                win.hide();
                dialog.showMessageBox(win, {
                    title: 'Update available',
                    message: 'A new version of GameDesktop is available. The update will download.',
                    type: 'info',
                    buttons: ba
                }).then((res) => {
                    tray.destroy();
                    if (res.response == 0) {
                        var updateWin = new BrowserWindow(({
                            width: 300,
                            height: 100,
                            frame: false,
                            title: 'GameBanana Update',
                            webPreferences: {
                                nodeIntegration: true
                            }
                        }));

                        updateWin.loadFile(__dirname + '/../Web/UPDATE.html');

                        const primaryDisplay = screen.getPrimaryDisplay();
                        const { width, height } = primaryDisplay.workAreaSize;
                        updateWin.setPosition(width - 300, height - 100);

                        updateWin.on('closed', () => {
                            updateWin = null;
                        });

                        updateWin.show();

                        var paths = axios.get('https://gamebanana.com/apiv11/Tool/18841/ProfilePage').then(response => {
                            console.log('EXE path:', response.data._aFiles[0]._sDownloadUrl);
                            
                            progress(request(response.data._aFiles[0]._sDownloadUrl), {

                            })
                            .on('progress', function (state) {
                                // The state is an object that looks like this:
                                // {
                                //     percent: 0.5,               // Overall percent (between 0 to 1)
                                //     speed: 554732,              // The download speed in bytes/sec
                                //     size: {
                                //         total: 90044871,        // The total payload size in bytes
                                //         transferred: 27610959   // The transferred payload size in bytes
                                //     },
                                //     time: {
                                //         elapsed: 36.235,        // The total elapsed seconds since the start (3 decimals)
                                //         remaining: 81.403       // The remaining seconds to finish (3 decimals)
                                //     }
                                // }
                                updateWin.webContents.executeJavaScript(`document.getElementById('progress').value = ${state.percent * 100};`);
                            })
                            .on('error', function (err) {
                                updateWin.close();
                                dialog.showErrorBox('GameDesktop Updating Error', 'An error occurred while downloading the update. Please try again later.');
                                process.exit();
                            })
                            .on('end', function () {
                                updateWin.close();
                                dialog.showMessageBox({
                                    title: 'GameDesktop',
                                    message: 'The update has been downloaded! The installer will now open.',
                                    type: 'info'
                                }).then(() => {
                                    shell.openExternal(app.getPath('downloads') + '/GDUpdateSetup.exe');
                                    process.exit();
                                });
                            })
                            .pipe(fs.createWriteStream(app.getPath('downloads') + '/GDUpdateSetup.exe'));
                        });
                    }
                    else {
                        win.show();
                        createAppBarIcon(win);
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error fetching updates:', error);
        });

    win = new BrowserWindow(windowOpt({
        width: 1280,
        height: 720,
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
    }));

    win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        callback({});
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
        setTimeout(function() {
            win.webContents.executeJavaScript(fs.readFileSync(__dirname + '/../Web/OnLoad.js', 'utf8').replace('$CSS$', fs.readFileSync(__dirname + '/../Web/Override.css', 'utf8')));

            console.log('Page loaded!');
        }, 900);
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
        var modal = new BrowserWindow(windowOpt(
            {
                parent: win,
                modal: true,
                width: 1200,
                height: 800,
                title: 'Settings',
                webPreferences: {
                    nodeIntegration: true,
                    preload: __dirname + '/../Web/settingsIPC.js'
                }
            }
        ));
        modal.setMenuBarVisibility(false);
        modal.loadFile(__dirname + '/../Web/settings.html');
        modal.webContents.on('did-finish-load', () => {
            modal.webContents.executeJavaScript('receiveSettings({frequency: ' + MINUTES + ', background: ' + !fs.existsSync(app.getPath('appData') + '/noBG', 'utf8') + '})');
        });
        modal.webContents.setWindowOpenHandler(({ url }) => {
            require('electron').shell.openExternal(url);
            return { action: 'deny' };
        });
        modal.webContents.on('did-navigate', (event, url) => {
            if (!url.includes('Code/Web/settings.html')) {
                event.preventDefault();
                require('electron').shell.openExternal(url);
                modal.webContents.executeJavaScript('window.history.back()');
            }
        });
        ipcMain.on('2fa', (event, data) => {
            modal.close();
            dialog.showMessageBox({
                title: 'GameBanana',
                message: 'To continue setup of 2FA authentication: please open the 2FA menu in the GameBanana settings.',
                type: 'info'
            });
            setup2FA = true;

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

            dialog.showMessageBox(modal, {
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

    win.webContents.on('will-navigate', (event, turl) => {
        url = turl;
    });
    ipcMain.on('callOnLoad', (event) => {
        var calling = BrowserWindow.getFocusedWindow();

        if (!checkedNotifs) {
            checkForNotifications(calling);
            checkedNotifs = true;
        }
        if (!url.includes('gamebanana.com') && url != '') {
            event.preventDefault();
            require('electron').shell.openExternal(url);
            calling.webContents.executeJavaScript('window.history.back()');
        }

        var urlWithoutNumber = url.replace(/[0-9]/g, '');
        if (urlWithoutNumber == ('https://gamebanana.com/members/settings/')) {
            console.log('Injecting settings');
            setTimeout(() => {
                var urlWithoutNumber = url.replace(/[0-9]/g, '');
                console.log('"' + urlWithoutNumber + '"');
                if (!urlWithoutNumber.endsWith('https://gamebanana.com/members/settings/')) {
                    console.log('DOUBLE INJECT');
                     return;
                } // Might be a fix??
                calling.webContents.executeJavaScript(`
                    var cc = document.querySelector('module#SettingsPortalModule .Content');
                    cc.innerHTML += \`` + fs.readFileSync('${__dirname}/../Code/Web/gbsetting.htm', 'utf8') + "\`;");
            }, 1600);
        }

        if (url.includes('trash') || url.includes('settings/password/')) {
            calling.hide();
            dialog.showMessageBox({
                type: 'warning',
                title: 'Elevated action warning',
                message: 'This page requires elevated permissions. Windows will ask you admin permissions to continue.',
            }).then(function() {
                var elevate = require('windows-elevate');

                elevate.exec('echo', 'Admin perms test', function(error, stdout, stderror) {
                    if (error) {
                        console.error('Failed!');
                        calling.show();
                        calling.webContents.executeJavaScript('window.history.back()');
                        return;
                    }

                    calling.show();
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