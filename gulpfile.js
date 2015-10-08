var browserify = require('browserify');
var source = require('vinyl-source-stream');
var gulp = require('gulp');
var through = require('through2');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var streamify = require('gulp-streamify');
var gutil = require('gulp-util');
var download = require("gulp-download");
var gunzip = require('gulp-gunzip');
var untar = require('gulp-untar2');
var shell = require('gulp-shell');
var jasmine = require('gulp-jasmine');
var reporters = require('jasmine-reporters');
var jasminePhantomJs = require('gulp-jasmine2-phantomjs');
var babelify = require('babelify');
var babel = require('gulp-babel');
var watch = require('gulp-watch');
var batch = require('gulp-batch');
var fs = require("fs");

gulp.task('default', ["test", "browser"]);

/** Build all-in-one files for use in the browser */
gulp.task('browser', function () {

  var browserOutput = 'build/browser';
  var testFiles = [];
  gulp.src('./test/**/*.test.js')
    .pipe( through.obj( function( file, enc, cb ) {
      testFiles.push( file.path );
      cb();
    }, function(cb) {
      // At end-of-stream, push the list of files to the next step
      this.push( testFiles );
      cb();
    }))
    .pipe( through.obj( function( testFiles, enc, cb) {
      browserify({ 
          entries: testFiles,  
          debug: true 
        }).transform(babelify)
        .bundle()
        .on('error', gutil.log)
        .pipe(source('neo4j-web.test.js'))
        .pipe(gulp.dest(browserOutput));
    }));


  // Our app bundler
  var appBundler = browserify({
    entries: ['lib/neo4j.js'],
    cache: {},
    standalone: 'neo4j',
    packageCache: {}
  }).transform(babelify);

  // Un-minified browser package
  appBundler.bundle()
    .on('error', gutil.log)
    .pipe(source('neo4j-web.js'))
    .pipe(gulp.dest(browserOutput));

  appBundler.bundle()
    .on('error', gutil.log)
    .pipe(source('neo4j-web.min.js'))
    .pipe(gulp.dest(browserOutput))
    .pipe(streamify(uglify()));
});

var buildNode = function(options) {
  return gulp.src(options.src)
    .pipe(babel())
    .pipe(gulp.dest(options.dest))
}

gulp.task('nodejs', function(){
  return buildNode({
    src: 'lib/**/*.js',
    dest: 'build/node'
    });
})

gulp.task('all', ['nodejs', 'browser']);

gulp.task('test', ['test-nodejs', 'test-browser']);

gulp.task('start-neo4j', ['download-neo4j'], shell.task([
  'chmod +x build/neo4j-enterprise*/bin/neo4j',
  'build/neo4j-enterprise*/bin/neo4j start',
]));

gulp.task('stop-neo4j', shell.task([
  'build/neo4j-enterprise*/bin/neo4j stop',
]));

gulp.task('test-nodejs', ['nodejs'], function () {
  return gulp.src('test/**/*.test.js')
        .pipe(jasmine({
            // reporter: new reporters.JUnitXmlReporter({
            //   savePath: "build/nodejs-test-reports",
            //   consolidateAll: false
            // }),
            includeStackTrace: true
        }));
});

gulp.task('test-browser', ['browser'], function () {
  // TODO: We should not use PhantomJS directly, instead we should run this via Karma to get wide cross-browser testing
  return gulp.src('./test/browser/testrunner-phantomjs.html').pipe(jasminePhantomJs());
});

gulp.task('watch', function () {
    watch('lib/**/*.js', batch(function (events, done) {
        gulp.start('all', done);
    }));
});

gulp.task('download-neo4j', function() {
  if( !fs.existsSync('./build/neo4j-enterprise-3.0.0-alpha') ) {
    // Need to download
    return download("http://alpha.neohq.net/dist/neo4j-enterprise-3.0.0-alpha-unix.tar.gz")
          .pipe(gunzip())
          .pipe(untar())
          .pipe(gulp.dest('./build'));
  }
});
