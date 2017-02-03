/**
 * Created by nilsbergmann on 31.01.17.
 */
// Electron stuff:
const isDev = require('electron-is-dev');
const {ipcRenderer} = require('electron');
const {Socket} = require('electron-ipc-socket');
const AutoLaunch = require('auto-launch');
const socket = Socket('MainSocket', ipcRenderer);
const pretty = require('prettysize');

socket.open();

if (isDev) {
    const debugMenu = require('debug-menu');
    debugMenu.install();
}
// Client
const app = angular.module('DSBApp', ['ngMaterial', 'ngAnimate', 'md.data.table', 'hc.marked']);
app.controller('DSBController', ($scope, $timeout, $rootScope, $mdToast, $mdDialog) => {
    $scope.safeApply = function (fn) {
        const phase = this.$root.$$phase;
        if (phase == '$apply' || phase == '$digest') {
            if (fn && (typeof(fn) === 'function')) {
                fn();
            }
        } else {
            this.$apply(fn);
        }
    };
    $scope.loaded = false;
    $scope.loading = false;
    $scope.firstBootstrap = true;
    $scope.bootstrap = () => {
        if ($scope.firstBootstrap){
            $scope.firstBootstrap = false;
            $scope.checkUpdateAvailable(false);
        }
        $scope.checkDialog(() => {
            $scope.loading = true;
            $scope.ProgressBar = true;
            $scope.ProgressMode = "indeterminate";
            $scope.safeApply(() => {
                socket.send('SETUP_DSB', {
                    host: $scope.host,
                    username: $scope.username,
                    password: $scope.password,
                    path: $scope.path
                }, (error, payload) => {
                    if (payload.error) {
                        $scope.loading = false;
                        $mdToast.showSimple(`Error: ${payload.error}`);
                    } else {
                        $scope.ProgressMode = "determinate";
                        $scope.ProgressValue = 0;
                        $scope.safeApply(() => {
                            socket.send('QUERY_DSB', {}, (error, payload) => {
                                $scope.loading = false;
                                if (error) {
                                    console.error(error);
                                    return;
                                }
                                if (!payload.error) {
                                    $scope.Plans = payload.Plans;
                                    $scope.ProgressValue = 100;
                                    $scope.ProgressBar = true;
                                    $scope.Plans.sort(function (a, b) {
                                        console.log(Date.parse(b.date) - Date.parse(a.date));
                                        return Date.parse(b.date) - Date.parse(a.date);
                                    });
                                    for (let Index in $scope.Plans) {
                                        if ($scope.Plans.hasOwnProperty(Index)) {
                                            $scope.Plans[Index].date = Date.parse($scope.Plans[Index].date).toString('dd.MM.yy dddd');
                                            $scope.Plans[Index].lastUpdate = Date.parse($scope.Plans[Index].lastUpdate).toString('dd.MM HH:mm');
                                        }
                                    }
                                    $scope.PlanC = JSON.parse(JSON.stringify($scope.Plans));
                                    $scope.applyFilter();
                                    $scope.safeApply(function () {
                                        console.log(payload);
                                    });
                                } else {
                                    $mdToast.showSimple(`Error: ${payload.error}`);
                                }
                            });
                        });
                    }
                });
            });
        });
    };

    socket.on('event:DSB_PROGRESS', (DATA) => {
        console.log("[Client] Progress...", DATA);
        $scope.ProgressValue = percentage.from(DATA.PROGRESS, DATA.MAX);
        $scope.safeApply();
    });

    socket.on('event:UPDATE_AVAILABLE', (info) => {
        console.log(`[Client] Update new update information's`);
        $scope.UpdateInfo = info;
    });

    $scope.applyFilter = function () {
        $scope.Plans = JSON.parse(JSON.stringify($scope.PlanC));
        let klassen = [];
        for (let Index in $scope.jahrgaengefilter) {
            if ($scope.jahrgaengefilter.hasOwnProperty(Index)) {
                const Stufe = $scope.jahrgaengefilter[Index];
                for (let BIndex in $scope.klassenfilter) {
                    if ($scope.klassenfilter.hasOwnProperty(BIndex)) {
                        const Buchstabe = $scope.klassenfilter[BIndex];
                        klassen.push(`${Stufe}${Buchstabe}`);
                    }
                }
            }
        }
        $scope.klassen = JSON.parse(JSON.stringify(klassen));
        if (klassen.length == 0) {
            $scope.Plans = $scope.PlanC;
            console.log("No filter");
            return;
        }
        for (let Index in $scope.Plans) {
            if (!$scope.Plans.hasOwnProperty(Index)) continue;
            let CopyPlan = $scope.Plans[Index].plan;
            $scope.Plans[Index].plan = [];
            for (let PlanIndex in CopyPlan) {
                if (!CopyPlan.hasOwnProperty(PlanIndex)) continue;
                for (let KlassenIndex in klassen) {
                    if (!klassen.hasOwnProperty(KlassenIndex)) continue;
                    if (CopyPlan[PlanIndex].Klassen.indexOf(klassen[KlassenIndex].toUpperCase()) != -1) {
                        $scope.Plans[Index].plan.push(CopyPlan[PlanIndex]);
                        break;
                    }
                }
            }
        }
    };

    $scope.UpdateAvailableDialog = () => {
        $mdDialog.show({
            templateUrl: 'UpdateAvailableDialog.html',
            scope: $scope,
            preserveScope: true,
            clickOutsideToClose: false,
            escapeToClose: false,
            fullscreen: true,
            controller: ($scope, $mdDialog, $mdToast) => {
                socket.on('event:UPDATE_AVAILABLE', (error, info) => {
                    console.log(`[Client] Update new update information's`, info);
                    $scope.UpdateInfo = info;
                    $scope.safeApply();
                });
                socket.on('event:UPDATER_ERROR', (error, Payload) => {
                    let alert = $mdDialog.alert().title(`An error occurred`).textContent(Payload.error).ok('Close');
                    $mdDialog.show(alert).finally(() => {
                        alert = null;
                    });
                });
                socket.on('event:UPDATE_DOWNLOADED', () => {
                    console.log(`[Client] Update downloaded.`);
                    $scope.finished = true;
                    $scope.downloading = true;
                    $scope.safeApply();
                    socket.send('QUIT_AND_INSTALL');
                });
                socket.on('event:UPDATE_DOWNLOAD_PROGRESS', (error, Payload) => {
                    $scope.DownloadProgressMode = "determinate";
                    console.log(`[Client] Download progress: `, Payload);
                    $scope.speed = Payload.bytesPerSecond ? pretty(Payload.bytesPerSecond) + "/s" : "0 bytes/s";
                    $scope.downloading = true;
                    $scope.DownloadProgress = Payload.percent ? Payload.percent : 0;
                    $scope.safeApply();
                });
                $scope.nope = function () {
                    $mdDialog.hide();
                };
                $scope.downloadAndInstall = function () {
                    $scope.DownloadProgressMode = "indeterminate";
                    $scope.safeApply(() => {
                        socket.send('DOWNLOAD_UPDATE', (error, Payload) => {
                            if (Payload.started) {
                                $scope.downloading = true;
                                $scope.safeApply();
                            } else {
                                $mdToast.showSimple('Something went wrong.');
                            }
                        });
                    });
                };
                $scope.downloading = false;
                $scope.finished = false;
                $scope.LoadingReleaseData = true;
                $scope.safeApply();
                socket.send('GET_UPDATE_INFO', (error, Payload) => {
                    console.log(`[Client] Received update info.`, Payload);
                    $scope.version = Payload.version;
                    $scope.releaseNotes = Payload.changelog;
                    $scope.LoadingReleaseData = false;
                    $scope.safeApply();
                });
            }
        });
    };

    $scope.checkUpdateAvailable = (button) => {
        if (socket.isOpen()){
            socket.send('CHECK_FOR_UPDATE', null, (error, UpdateAvailable) => {
                console.log(`[Client] Update available: ${UpdateAvailable}`);
                if (UpdateAvailable) {
                    $scope.UpdateAvailableDialog();
                } else {
                    if (button){
                        $mdToast.showSimple('No update available.');
                    }
                }
            });
        }
    };

    $scope.settings = function (callback) {
        $mdDialog.show({
            templateUrl: 'SettingsDialog.html',
            scope: $scope,
            preserveScope: true,
            hasBackdrop: true,
            fullscreen: true,
            controller: ($scope, $mdDialog) => {
                // BACKUP OF VALUES
                const jb = copy($scope.jahrgaengefilter);
                const kb = copy($scope.klassenfilter);
                const ab = copy($scope.autoStart);
                $scope.save = function () {
                    saveValue('jahrgaengefilter', $scope.jahrgaengefilter, () => {
                        saveValue('klassenfilter', $scope.klassenfilter, () => {
                            saveValue('autoStart', $scope.autoStart, () => {
                                saveValue('host', $scope.host, () => {
                                    saveValue('password', $scope.password, () => {
                                        saveValue('username', $scope.username, () => {
                                            saveValue('path', $scope.path, () => {
                                                saveValue('hideAutoStart', $scope.hideAutoStart, () => {
                                                    if ($scope.Plans) {
                                                        $scope.applyFilter();
                                                    }
                                                    $scope.safeApply();
                                                    $mdDialog.hide();
                                                    $scope.applyAutoStart();
                                                    socket.send('DELETE_COOKIES');
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                };
                $scope.cancel = function () {
                    // Restore original
                    $scope.jahrgaengefilter = copy(jb);
                    $scope.klassenfilter = copy(kb);
                    $scope.autoStart = copy(ab);
                    $mdDialog.hide();
                };
            },
            onRemoving: () => {
                if (callback) {
                    callback();
                }
            }
        });
    };
    $scope.checkDialog = (callback) => {
        if (!$scope.host || !$scope.username || !$scope.password) {
            $scope.settings(() => {
                $scope.checkDialog(() => {
                    callback();
                });
            });
        } else {
            callback();
        }
    };
    $scope.dsbSetUpPrepare = (Callback) => {
        getValue('host', (error, host) => {
            $scope.host = host ? host : null;
            getValue('username', (error, username) => {
                $scope.username = username ? username : null;
                getValue('password', (error, password) => {
                    $scope.password = password ? password : null;
                    getValue('path', (error, path) => {
                        $scope.path = path ? path : null;
                        $scope.checkDialog(Callback);
                    });
                });
            });
        });
    };
    $scope.applyAutoStart = () => {
        if (!$scope.AutoLaunchApp) {
            $scope.AutoLaunchApp = new AutoLaunch({
                name: "DSB Client",
                isHidden: $scope.hideAutoStart
            });
        }
        if ($scope.autoStart) {
            if ($scope.autoStart == true) $mdToast.showSimple(`Auto start enabled.`);
            $scope.AutoLaunchApp.enable();
        } else {
            if ($scope.autoStart == false) $mdToast.showSimple(`Auto start disabled.`);
            $scope.AutoLaunchApp.disable();
        }
    };
    $timeout(() => {
        getValue('jahrgaengefilter', (error, jahrgaengefilter) => {
            $scope.jahrgaengefilter = jahrgaengefilter ? jahrgaengefilter : [];
            getValue('klassenfilter', (error, klassenfilter) => {
                $scope.klassenfilter = klassenfilter ? klassenfilter : [];
                getValue('autoStart', (error, autoStart) => {
                    $scope.autoStart = autoStart ? autoStart : false;
                    getValue('hideAutoStart', (error, hideAutoStart) => {
                        $scope.hideAutoStart = hideAutoStart ? hideAutoStart : false;
                        $scope.dsbSetUpPrepare(() => {
                            $scope.loaded = true;
                            $scope.applyAutoStart();
                            $scope.safeApply(() => {
                                $scope.bootstrap();
                            });
                        });
                    });
                });
            });
        });
    }, 100);
});
app.config(function ($mdThemingProvider) {
    $mdThemingProvider.theme('altTheme')
        .primaryPalette('grey', {
            'default': '900'
        })
        .accentPalette('grey', {
            'default': '700'
        })
        .dark();
    $mdThemingProvider.theme('default')
        .dark();
    $mdThemingProvider.setDefaultTheme('altTheme');
    $mdThemingProvider.alwaysWatchTheme(true);
    $mdThemingProvider.theme('docs-dark', 'default')
        .primaryPalette('yellow')
        .dark();
});

app.config(['markedProvider', function (markedProvider) {
    markedProvider.setOptions({gfm: true, tables: true});
}]);

function copy(what) {
    return JSON.parse(JSON.stringify(what))
}