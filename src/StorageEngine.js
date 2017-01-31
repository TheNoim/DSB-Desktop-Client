/**
 * Created by nilsbergmann on 30.01.17.
 */
const storage = require('electron-json-storage');

const defaults = {
    "jahrgaengefilter": [], // Jahrgänge Filter
    "klassenfilter": [], // Klassen Filter
    "autoStart": false,
    "hideAutoStart": false,
    "username": null,
    "password": null,
    "host": null,
    "path": null
};

function getValue(key, callback) {
    storage.has(key, (error, has) => {
        if (error) {
            callback(error);
        } else {
            if (has){
                storage.get(key, callback);
            } else {
                if (defaults[key]){
                    callback(null, defaults[key]);
                } else {
                    callback("No value");
                }
            }
        }
    });
}

function saveValue(key, value, callback) {
    storage.set(key, value, callback);
}