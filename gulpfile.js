/**
 * Created by nilsbergmann on 31.01.17.
 */
const gulp = require('gulp');
const gulpSequence = require('gulp-sequence');
const clean = require('gulp-clean');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const htmlmin = require('gulp-htmlmin');
const inline = require('gulp-inline');
const minifyCss = require('gulp-minify-css');
const del = require('del');
const packager = require('electron-packager');
const fs = require('fs');
const yarn = require('gulp-yarn');

gulp.task('default', gulpSequence('clean', ['minify-js', 'minify-html', 'copy-components', 'copy-css'], 'inline', ['delete-components', 'delete-js', 'delete-css'], ['copy-md-icons', 'copy-package-json']));

gulp.task('package', gulpSequence('clean-package', 'build-package'));

gulp.task('darwin', gulpSequence('clean-package', 'default', 'darwin-build-package'));

gulp.task('clean', function () {
    return gulp.src('./www').pipe(clean());
});

gulp.task('yarn', function () {
    return gulp.src(['./www/package.json'])
        .pipe(yarn({production: true}))
        .pipe(gulp.dest('./www'));
});

gulp.task('copy-package-json', function () {
    const packagejson = require('./package.json');
    delete packagejson.build;
    packagejson.main = "main.js";
    return fs.writeFileSync('./www/package.json', JSON.stringify(packagejson));
});

gulp.task('copy-components', function () {
    return gulp.src('./src/components/**/*').pipe(gulp.dest('./www/components'));
});
gulp.task('copy-css', function () {
    return gulp.src('./src/*.css').pipe(gulp.dest('./www'));
});

gulp.task('minify-js', function () {
    return gulp.src('./src/*.js')
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(uglify({
            mangle: false
        }))
        .pipe(gulp.dest('./www'));
});

gulp.task('minify-html', function () {
    return gulp.src('./src/*.html')
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('./www'));
});

gulp.task('inline', function () {
    return gulp.src('./www/*.html').pipe(inline({
        base: './www',
        css: minifyCss
    })).pipe(gulp.dest('./www'));
});

gulp.task('delete-components', function () {
    return del.sync(['./www/components/**/*', '!./www/components/**/*.map', '!./www/components/material-design-icons/**/*']);
});

gulp.task('delete-js', function () {
    return del.sync(['./www/*.js', '!./www/main.js']);
});

gulp.task('delete-css', function () {
    return del.sync(['./www/*.css']);
});

gulp.task('copy-md-icons', function () {
    return gulp.src(['./src/components/material-design-icons/iconfont/**/*.ttf', './src/components/material-design-icons/iconfont/**/*.woff', './src/components/material-design-icons/iconfont/**/*.woff2']).pipe(gulp.dest('./www/'));
});

gulp.task('clean-package', function () {
    return gulp.src('./www').pipe(clean());
});

gulp.task('build-package', function (cb) {
    packager({
        dir: ".",
        all: true,
        "app-version": require('./package.json').version,
        asar: true,
        icon: "./Icon",
        ignore: [
            /^\/(vendor|www|sig|docs|src|test|.cert.pfx|.editorconfig|.eslintignore|.eslintrc|.gitignore|.travis.yml|appveyor.yml|circle.yml|CONTRIBUTING.md|Gruntfile.js|gulpfile.js|ISSUE_TEMPLATE.md|LICENSE|README.md)(\/|$)/g,
            'bower.json',
            '.bowerrc',
            'yarn.lock',
            'builds/'
        ],
        arch: 'all',
        platform: 'all',
        "app-bundle-id": 'io.noim.dsbclient',
        out: './builds',
        prune: true,
        derefSymlinks: true
    }, (err, appPaths) => {
        console.error(err);
        console.log(appPaths);
        cb();
    });
});

gulp.task('darwin-build-package', function (cb) {
    packager({
        dir: ".",
        "app-version": require('./package.json').version,
        asar: true,
        icon: "./Icon",
        ignore: [
            /^\/(vendor|www|sig|docs|src|test|.cert.pfx|.editorconfig|.eslintignore|.eslintrc|.gitignore|.travis.yml|appveyor.yml|circle.yml|CONTRIBUTING.md|Gruntfile.js|gulpfile.js|ISSUE_TEMPLATE.md|LICENSE|README.md)(\/|$)/g,
            'bower.json',
            '.bowerrc',
            'yarn.lock',
            'builds/'
        ],
        arch: 'all',
        platform: 'darwin',
        "app-bundle-id": 'io.noim.dsbclient',
        out: './builds',
        prune: true,
        derefSymlinks: true
    }, (err, appPaths) => {
        console.error(err);
        console.log(appPaths);
        cb();
    });
});