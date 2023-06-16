const gulp = require('gulp');
// const uglify = require('gulp-uglify');
// const minify = require('gulp-minify');
const rename = require('gulp-rename');
const concat = require('gulp-concat-util');
const compress = require('gulp-minify-css');
const clean = require('gulp-clean');

const target = `./public/legacy`;

gulp.task('clean-minimized', function () {
  return gulp.src('minimized', { read: false }).pipe(clean());
});

gulp.task('copy-css-img', function () {
  return gulp.src(['src/js/legacy/css/img/*']).pipe(gulp.dest(target + '/css/img'));
});

gulp.task('copy-css-images', function () {
  return gulp.src(['src/js/legacy/css/images/*']).pipe(gulp.dest(target + '/css/images'));
});

gulp.task('compress-css', ['clean-minimized'], function () {
  return gulp
    .src(['src/js/legacy/css/*.css'])
    .pipe(compress())
    .pipe(rename({ suffix: '.min' }))
    .pipe(gulp.dest('src/js/legacy/minimized'));
});

gulp.task('concat-css', ['compress-css'], function () {
  return gulp
    .src(['src/js/legacy/minimized/*.css'])
    .pipe(concat('style.css'))
    .pipe(gulp.dest(target + '/css'));
});

gulp.task('default', ['concat-css']);
