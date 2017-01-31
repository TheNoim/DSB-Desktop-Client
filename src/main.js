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

let MainWindow = null;
let dsb;
console.log(app.getPath('userData'));

function createWindow() {
    MainWindow = new BrowserWindow({width: 1200, height: 800});
    MainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));
    if (isDev) {
        MainWindow.webContents.openDevTools();
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
        if (dsb){
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
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', () => {
    if (MainWindow === null) {
        createWindow();
    }
});

function setUpDSBEvents(socket) {
    if (dsb){
        const Events = dsb.Events;
        Events.on('progress', (MAX, PROGRESS) => {
            console.log('[Background] Progress - ' + PROGRESS);
            if (!socket.isOpen()){
                socket.open();
            }
            socket.send('DSB_PROGRESS', {MAX: MAX, PROGRESS: PROGRESS});
        });
    }
}