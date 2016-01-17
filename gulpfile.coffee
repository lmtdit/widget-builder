fs      = require 'fs'
path    = require 'path'
gulp    = require 'gulp'
gutil   = require 'gulp-util'
color   = gutil.colors
log     = gutil.log

# 全局资源map
global.Cache = require '../../global/globalMap.json'
# console.log global.Cache['cssMap']

# 构建工具
build   = require 'tms-widget-builder'

###
# ************* 构建任务函数 *************
###

gulp.task 'init',->
    build.init()

gulp.task 'less',->
    build.less2js()

gulp.task 'tpl',->
    build.tpl2js()

gulp.task 'js',['less','tpl'],->
    build.js2dist()

gulp.task 'watch',->
    build.watch()

gulp.task 'server',->
    build.server()

gulp.task 'default',['js','server'],->
    gulp.start 'watch'