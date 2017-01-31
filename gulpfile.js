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

gulp.task('darwin', gulpSequence('clean-package', 'default', 'darwin-build-package'));

gulp.task('clean', function () {
    return gulp.src('./dist').pipe(clean());
});

gulp.task('copy-components', function () {
    return gulp.src('./src/components/**/*').pipe(gulp.dest('./dist/components'));
});
gulp.task('copy-css', function () {
    return gulp.src('./src/*.css').pipe(gulp.dest('./dist'));
});

gulp.task('minify-js', function () {
    return gulp.src('./src/*.js')
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(uglify({
            mangle: false
        }))
        .pipe(gulp.dest('./dist'));
});

gulp.task('minify-html', function () {
    return gulp.src('./src/*.html')
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest('./dist'));
});

gulp.task('inline', function () {
    return gulp.src('./dist/*.html').pipe(inline({
        base: './dist',
        css: minifyCss
    })).pipe(gulp.dest('./dist'));
});

gulp.task('delete-components', function () {
    return del.sync(['./dist/components/**/*', '!./dist/components/**/*.map', '!./dist/components/material-design-icons/**/*']);
});

gulp.task('delete-js', function () {
    return del.sync(['./dist/*.js', '!./dist/main.js']);
});

gulp.task('delete-css', function () {
    return del.sync(['./dist/*.css']);
});

gulp.task('copy-md-icons', function () {
    return gulp.src(['./src/components/material-design-icons/iconfont/**/*.ttf', './src/components/material-design-icons/iconfont/**/*.woff', './src/components/material-design-icons/iconfont/**/*.woff2']).pipe(gulp.dest('./dist/'));
});

gulp.task('clean-package', function () {
    return gulp.src('./dist').pipe(clean());
});

gulp.task('build-package', function (cb) {
    packager({
        dir: ".",
        all: true,
        "app-version": require('./package.json').version,
        asar: true,
        icon: "./Icon",
        ignore: [
            /^\/(vendor|dist|sig|docs|src|test|.cert.pfx|.editorconfig|.eslintignore|.eslintrc|.gitignore|.travis.yml|appveyor.yml|circle.yml|CONTRIBUTING.md|Gruntfile.js|gulpfile.js|ISSUE_TEMPLATE.md|LICENSE|README.md)(\/|$)/g,
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
            /^\/(vendor|dist|sig|docs|src|test|.cert.pfx|.editorconfig|.eslintignore|.eslintrc|.gitignore|.travis.yml|appveyor.yml|circle.yml|CONTRIBUTING.md|Gruntfile.js|gulpfile.js|ISSUE_TEMPLATE.md|LICENSE|README.md)(\/|$)/g,
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