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

gulp.task('default', gulpSequence('clean', ['minify-js', 'minify-html', 'copy-components', 'copy-css'], 'inline', ['delete-components', 'delete-js', 'delete-css'], 'copy-md-icons'));

gulp.task('package', gulpSequence('clean-package', 'build-package'));

gulp.task('clean', function () {
    return gulp.src('./build').pipe(clean());
});

gulp.task('copy-components', function () {
    return gulp.src('./src/components/**/*').pipe(gulp.dest('./build/components'));
});
gulp.task('copy-css', function () {
    return gulp.src('./src/*.css').pipe(gulp.dest('./build'));
});

gulp.task('minify-js', function () {
    return gulp.src('./src/*.js')
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(uglify({
            mangle: false
        }))
        .pipe(gulp.dest('./build'));
});

gulp.task('minify-html', function () {
    return gulp.src('./src/*.html')
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('./build'));
});

gulp.task('inline', function () {
    return gulp.src('./build/*.html').pipe(inline({
        base: './build',
        css: minifyCss
    })).pipe(gulp.dest('./build'));
});

gulp.task('delete-components', function () {
    return del.sync(['./build/components/**/*', '!./build/components/**/*.map', '!./build/components/material-design-icons/**/*']);
});

gulp.task('delete-js', function () {
    return del.sync(['./build/*.js', '!./build/main.js']);
});

gulp.task('delete-css', function () {
    return del.sync(['./build/*.css']);
});

gulp.task('copy-md-icons', function () {
    return gulp.src(['./src/components/material-design-icons/iconfont/**/*.ttf', './src/components/material-design-icons/iconfont/**/*.woff', './src/components/material-design-icons/iconfont/**/*.woff2']).pipe(gulp.dest('./build/'));
});

gulp.task('clean-package', function () {
    return gulp.src('./builds').pipe(clean());
});

gulp.task('build-package', function (cb) {
    packager({
        dir: ".",
        all: true,
        "app-version": require('./package.json').version,
        asar: false,
        icon: "./Icon",
        ignore: [
            'src/',
            'bower.json',
            '.bowerrc',
            'yarn.lock',
            'builds/'
        ],
        arch: 'all',
        platform: 'all',
        platforms: 'all',
        "app-bundle-id": 'io.noim.dsbclient',
        out: './builds',
        prune: true,
        electronVersion: '1.4.13',
        derefSymlinks: true
    }, (err, appPaths) => {
        console.error(err);
        console.log(appPaths);
        cb();
    });
});