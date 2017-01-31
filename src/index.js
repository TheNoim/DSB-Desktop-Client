/**
 * Created by nilsbergmann on 31.01.17.
 */
// Electron stuff:
const isDev = require('electron-is-dev');
const {ipcRenderer} = require('electron');
const {Socket} = require('electron-ipc-socket');
const AutoLaunch = require('auto-launch');
const socket = Socket('MainSocket', ipcRenderer);
socket.open();

if (isDev) {
    const debugMenu = require('debug-menu');
    debugMenu.install();
}
// Client
const app = angular.module('DSBApp', ['ngMaterial', 'ngAnimate', 'md.data.table']);
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
    $scope.bootstrap = () => {
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

function copy(what) {
    return JSON.parse(JSON.stringify(what))
}