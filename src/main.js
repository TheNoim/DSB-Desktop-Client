/**
 * Created by nilsbergmann on 30.01.17.
 */
const {app, BrowserWindow, ipcMain} = require('electron');
const {Socket, Transport} = require('electron-ipc-socket');
const DSBLibrary = require('dsbiserv');
const path = require('path');
const url = require('url');
const isDev = require('electron-is-dev');
const validator = require('validator');
const fs = require('fs');
const {autoUpdater} = require('electron-updater');
const request = require('request');
autoUpdater.autoDownload = false;
autoUpdater.requestHeaders = {
    'User-Agent': 'request'
};

let MainWindow = null;
let dsb;
console.log(app.getPath('userData'));

function createWindow() {
    let GlobalWindowObject = {};

    MainWindow = new BrowserWindow({width: 1200, height: 800});
    MainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));
    if (isDev) {
        MainWindow.webContents.openDevTools();
        autoUpdater.setFeedURL({
            provider: "github",
            owner: "TheNoim",
            repo: "DSB-Desktop-Client"
        });
    }
    MainWindow.on('closed', () => {
        MainWindow = null;
    });
    const socket = Socket('MainSocket', Transport(ipcMain, MainWindow));
    socket.open();
    socket.on('message:SETUP_DSB', (msg) => {
        console.log("[Background] SETUP_DSB");
        const payload = msg.data();
        if (validator.isURL(payload.host, {require_protocol: false})) {
            if (validator.isLength(payload.username, {min: 2})) {
                if (validator.isLength(payload.password, {min: 1})) {
                    payload.path = payload.path ? payload.path : null;
                    dsb = new DSBLibrary(payload.host, payload.username, payload.password, app.getPath('userData') + '/cookie.json', true, payload.path);
                    console.log("[Background] DSB Instance created.");
                    setUpDSBEvents(socket);
                    msg.reply({
                        error: null
                    });
                } else {
                    console.error(`[Background] The password needs to contains at least 1 letter.`);
                    msg.reply({
                        error: "The password needs to contains at least 1 letter."
                    });
                }
            } else {
                console.error(`[Background] The username needs to contains at least 2 letters.`);
                msg.reply({
                    error: "The username needs to contains at least 2 letters."
                });
            }
        } else {
            console.error(`[Background] Not a valid host`);
            msg.reply({
                error: "Not a valid host"
            });
        }
    });
    socket.on('message:QUERY_DSB', (msg) => {
        if (dsb) {
            console.log("[Background] QUERY_DSB");
            console.log(JSON.stringify(dsb));
            dsb.getParsed((error, Plans) => {
                msg.reply({
                    error: error,
                    Plans: Plans
                });
            });
        }
    });
    socket.on('event:DELETE_COOKIES', () => {
        console.log("[BACKGROUND] Delete cookie.json.");
        fs.unlink(app.getPath('userData') + '/cookie.json', () => {
            console.log("[BACKGROUND] Delete cookie.json successfully!");
        });
    });

    socket.on('message:CHECK_FOR_UPDATE', (msg) => {
        autoUpdater.checkForUpdates().then(() => {
            console.log("[Background] Update available: " + autoUpdater.updateAvailable);
            console.log(autoUpdater);
            msg.reply(autoUpdater.updateAvailable);
        });
    });

    socket.on('message:GET_UPDATE_INFO', (msg) => {
        let ReleaseUrl;
        if (GlobalWindowObject.info) {
            ReleaseUrl = `https://api.github.com/repos/TheNoim/DSB-Desktop-Client/releases/tags/v${GlobalWindowObject.info.version}`;
        } else {
            ReleaseUrl = `https://api.github.com/repos/TheNoim/DSB-Desktop-Client/releases/latest`;
        }
        console.log('[Background] Request ' + ReleaseUrl);
        request(ReleaseUrl, {
            headers: {
                'User-Agent': 'request'
            }
        }, (error, response, body) => {
            console.log(`[Background] Request finished.`);
            if (!error && response.statusCode == 200) {
                let ReleaseJson;
                try {
                    ReleaseJson = JSON.parse(body);
                } catch (e) {
                    msg.reply({
                        version: GlobalWindowObject.info.version ? GlobalWindowObject.info.version : "Unknown",
                        changelog: "Changelog parsing error"
                    });
                    return;
                }
                msg.reply({
                    version: GlobalWindowObject.info.version ? GlobalWindowObject.info.version : "Unknown",
                    changelog: ReleaseJson.body ? ReleaseJson.body : "Failed to load changelog"
                });
            } else {
                msg.reply({
                    version: GlobalWindowObject.info.version ? GlobalWindowObject.info.version : "Unknown",
                    changelog: "Failed to load changelog - Status " + response.statusCode
                });
            }
        });
    });

    socket.on('message:DOWNLOAD_UPDATE', (msg) => {
        if (autoUpdater.updateAvailable) {
            autoUpdater.downloadUpdate();
            console.log(JSON.stringify(autoUpdater.downloadPromise));
            msg.reply({started: true});
        } else {
            msg.reply({started: false});
        }
    });

    socket.on('event:QUIT_AND_INSTALL', () => {
        autoUpdater.quitAndInstall();
    });

    autoUpdater.on('error', (error) => {
        console.log("[BACKGROUND] Auto Updater Error: " + error);
        if (socket.isOpen()) socket.send('UPDATER_ERROR', {error: error});
    });

    autoUpdater.on('update-available', (info) => {
        GlobalWindowObject.info = info;
        console.log("[BACKGROUND] Update available. " + JSON.stringify(info));
        if (socket.isOpen()) socket.send('UPDATE_AVAILABLE', {info: info});
    });

    autoUpdater.on('download-progress', (progressObj) => {
        console.log(`[BACKGROUND] Download: ${progressObj.percent} % ${progressObj.bytesPerSecond} b\\s`);
        if (socket.isOpen()) socket.send('UPDATE_DOWNLOAD_PROGRESS', {
            bytesPerSecond: progressObj.bytesPerSecond,
            percent: progressObj.percent,
            total: progressObj.total,
            transferred: progressObj.transferred
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log(`[BACKGROUND] Update download finished.`);
        if (socket.isOpen()) socket.send('UPDATE_DOWNLOADED', {info: info});
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (MainWindow === null) {
        createWindow();
    }
});

function setUpDSBEvents(socket) {
    if (dsb) {
        const Events = dsb.Events;
        Events.on('progress', (MAX, PROGRESS) => {
            console.log('[Background] Progress - ' + PROGRESS);
            if (!socket.isOpen()) {
                socket.open();
            }
            socket.send('DSB_PROGRESS', {MAX: MAX, PROGRESS: PROGRESS});
        });
    }
}