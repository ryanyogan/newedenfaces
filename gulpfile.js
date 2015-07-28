'use strict';

import gulp from 'gulp';
import gutil from 'gulp-util';
import gulpif from 'gulp-if';
import streamify from 'gulp-streamify';
import autoprefixer from 'gulp-autoprefixer';
import cssmin from 'gulp-cssmin';
import less from 'gulp-less';
import concat from 'gulp-concat';
import plumber from 'gulp-plumber';
import source from 'vinyl-source-stream';
import babelify from 'babelify';
import browserify from 'browserify';
import watchify from 'watchify';
import uglify from 'gulp-uglify';

const production = process.env.NODE_ENV === 'production';

const dependencies = [
  'alt',
  'react',
  'react-router',
  'underscore'
];

/*
/ Combine all JS libraries into a single file
*/
gulp.task('vendor', () => {
  return gulp.src([
    'bower_components/jquery/dist/jquery.js',
    'bower_components/bootstrap/dist/js/bootstrap.js',
    'bower_components/magnific-popup/dist/jquery.magnific-popup.js',
    'bower_components/toastr/toastr.js'
    ]).pipe(concat('vendor.js'))
      .pipe(gulpif(production, uglify({ mangle: false })))
      .pipe(gulp.dest('public/js'));
});

/*
 / Compile third party dependancies seperatley for faster performance
*/
gulp.task('browserify-vendor', () => {
  return browserify()
    .require(dependancies)
    .bundle()
    .pipe(source('vendor.bundle.js'))
    .pipe(gulpif(production, streamify({ mangle: false })))
    .pipe(gulp.dest('public/js'));
});

/*
 / Compile only project files, excluding all third-party
*/
gulp.task('browserify', ['browserify-vendor'], () => {
  let bundler = watchify(browserify('app/main.js', watchify.args));
  bundler.external(dependancies);
  bundler.transform(babelify);
  bundler.on('update', rebundle);
  return rebundle();

  function rebundle() {
    let start = Date.now();
    return bundler.bundle()
      .on('error', (err) => {
        gutil.log(gutil.colors.red(err.toString()));
      })
      .on('end', () => {
        gutil.log(gutil.colors.green(`Finished rendering in ${Date.now() - start}ms.`));
      })
      .pipe(source('bundle.js'))
      .pipe(gulp.dest('public/js'));
  }
});

/*
 / Compile LESS stylesheets
*/
gulp.task('styles', () => {
  return gulp.src('app/stylesheets/main.less')
    .pipe(plumber())
    .pipe(less())
    .pipe(autoprefixer())
    .pipe(gulpif(production, cssmin()))
    .pipe(gulp.dest('public/css'));
});

gulp.task('watch', () => {
  gulp.watch('app/stylesheets/**/*.kess', ['styles']);
});

gulp.task('default', ['styles', 'vendor', 'browserify-watch', 'watch']);
gulp.task('build', ['styles', 'vendor', 'browserify']);
