###*
 * TMS-black模块开发构建工具
 * @author [Pang.J.G]
 * @version [0.0.1]
 * @date  [2016-01-20 00:01:12]
 * @required [gulp]
###

fs      = require 'fs'
path    = require 'path'
gulp    = require 'gulp'
gulpIf  = require 'gulp-if'
gulpIg  = require 'gulp-ignore'
_       = require 'lodash'
crypto  = require 'crypto'
yargs   = require 'yargs'
less    = require 'gulp-less'
uglify  = require 'uglify-js'
autopre = require 'gulp-autoprefixer'
plumber = require 'gulp-plumber'
{JSHINT} = require 'jshint'
gutil   = require 'gulp-util'
log     = gutil.log
color   = gutil.colors
PluginError = gutil.PluginError
CleanCSS = require 'clean-css'
through2 = require 'through2'

# 设置运行的命令参数
argv = yargs.option("e", {
        alias: 'env',
        demand: true
        default: 'local',
        describe: color.cyan('项目的运行环境'),
        type: 'string'
    }).option("author", {
        default: 'lmtdit',
        describe: color.cyan('设置项目的作者'),
        type: 'string'
    }).option("email", {
        default: 'lmtdit@gmail.com',
        describe: color.cyan('设置项目作者的email'),
        type: 'string'
    }).option("hash", {
        alias: 'hashlen',
        default: 10,
        describe: color.cyan('设置生产文件名的hash长度'),
        type: 'number'
    }).option("cdn", {
        default: '',
        describe: color.cyan('设置项目发布的cdn域名'),
        type: 'string'
    })
    .help('h')
    .alias('h', 'help')
    .argv

# 全局的配置
tasks = argv._.concat([])
globalNameSpace = '_LIB_' #全局的命名空间
root =  process.env.INIT_CWD
defaultTasks = ['less','js','watch','default','public','public-all']
global.Cache = {}
try
  global.Cache = require '../global/globalMap.json'
catch error


# 一些正则
REGEX =
    uri: /globalUri\(('|")([^'|^"]*)(\w+).(png|gif|jpg|html|js|css)('|")\)/g
    uriVal: /\([\s\S]*?\)/
    cssBg: /url\([\S\s]*?\)/g
    bgUrl: /\([\s\S]*?.(png|jpg|gif)\)/

### ******************** base functions ******************** ###

Tools =
    # md5
    md5: (source) ->
        _buf = new Buffer(source)
        _str = _buf.toString("binary")
        return crypto.createHash('md5').update(_str, 'utf8').digest('hex')

    # make dir
    mkdirsSync: (dirpath, mode)->
        if fs.existsSync(dirpath)
            return true
        else
            if Tools.mkdirsSync path.dirname(dirpath), mode
                fs.mkdirSync(dirpath, mode)
                return true
    # 错误警报
    errHandler:(e,cb)->
        gutil.beep()
        gutil.beep()
        log e


    # 压缩css/js源码
    minify: (source,type)->
        type = type or "js"
        switch type
            when 'css'
                cssOpt = {
                        keepBreaks:false
                        compatibility:
                            properties:
                                iePrefixHack:true
                                ieSuffixHack:true
                    }

                mangled = new CleanCSS(cssOpt).minify(source)
                source = mangled.styles.replace(/\/\*([\s\S]*?)\*\//g, '')
            when 'js'
                source = Tools._replaceUriValue(source)
                mangled = uglify.minify(source,{fromString: true})
                source = mangled.code
            when 'html'
                source = source.replace(/<!--([\s\S]*?)-->/g, '')
                    .replace(/\/\*([\s\S]*?)\*\//g, '')
                    .replace(/^\s+$/g, '')
                    .replace(/\n/g, '')
                    .replace(/\t/g, '')
                    .replace(/\r/g, '')
                    .replace(/\n\s+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .replace(/>([\n\s+]*?)</g,'><')

        return source

    # 获取文件
    getFileSync: (file, encoding)->
        _encoding = encoding or 'utf8'
        fileCon = ''
        if fs.existsSync(file)
            stats = fs.statSync(file)
            if stats.isFile()
                fileCon = fs.readFileSync(file, _encoding)
        return fileCon

    # 读取json文件内容
    getJSONSync: (file) ->
        fileCon = Tools.getFileSync(file)
        data = {}
        if fileCon
            fileCon = fileCon.replace(/\/\/[^\n]*/g, '')
            try
                data = JSON.parse(fileCon)
            catch e
                console.log e

        return data
    # 写入文件
    writeFile: (file, source,offlog)->
        # 文件存在并且MD5值一样，则不重复写入
        name = path.basename(file);
        if fs.existsSync(file) and Tools.md5(Tools.getFileSync(file)) is Tools.md5(source)
            return false
        Tools.mkdirsSync(path.dirname(file))
        fs.writeFileSync(file, source, 'utf8')
        offlog or log("'" + color.cyan(file) + "'", "build success.")

    # 获取文件夹下的一级目录列表
    getFolders: (fPath)->
        folders = []
        try
            fs.readdirSync(fPath).forEach (v)->
                folder = path.join fPath,v
                if fs.statSync(folder).isDirectory() and v.indexOf('.') != 0
                    folders.push v
        catch error
            # log error.Error
        return folders

    # 获取文件夹下的文件列表列表
    getFiles: (fPath,type)->
        list = []
        try
            fs.readdirSync(fPath).forEach (v)->
                file = path.join fPath,v
                if fs.existsSync(file) and v.indexOf('.' + type) > 0
                    list.push file
        catch error
            # log error.Error
        return list

    # 生成 debug 文件路径
    _setDegbugPath: (parse)->
        parse.base = "_debug." + parse.name + parse.ext
        return path.format(parse)

    # 获取原文件名
    _setSrcPath: (parse)->
        parse.base = parse.name.replace('_debug.','') + parse.ext
        return path.format(parse)

    # 生成 dist 文件路径
    _setDistPath: (parse,hash)->
        parse.base = parse.name + "." + hash.substring(0,argv.hash) + parse.ext
        return path.format(parse)

    # 生成缓存的类型
    _setCacheType: (parse)->
        return parse.ext.replace('.','')

    # 从缓存中读取 dist 文件路径
    _getDistName: (type,name)->
        if _.has(global.Cache,type + "Map") and global.Cache[type + "Map"][name]
            return global.Cache[type + "Map"][name].distPath
        else
            return name

    # 替换JS中的内嵌资源
    # 例如：globalUri("dir/name.ext")-->globalUri("dir/name.md5hash.ext")
    _replaceUriValue: (source)->
        return source.replace REGEX.uri,(res)->
            _val = res.match(REGEX.uriVal).shift().replace(/[\(\)"']/g,'')
            _valArr = _val.split('/')
            type = _valArr.shift()
            name = _valArr.join('/')
            distName = Tools._getDistName(type,name)
            return res.replace(name,distName)

    # 替换css中的背景图片或字体文件引用资源
    # 例如：url('xxxxx.xxx')-->url('xxxxx.md5hash.xxx')
    _replaceCssBg: (source)->
        return source.replace REGEX.cssBg,(res)->
            _val = res.match(REGEX.uriVal).shift().replace(/[\(\)"']/g,'')
            if _val.indexOf('font/') != -1
                name = _val.split('font/')[1]
                            .split(/(\?|#)/)[0]
                distName = Tools._getDistName('font',name)
                return res.replace(name,distName)
            else if _val.indexOf('img/') != -1
                name = _val.split('img/')[1]
                distName = Tools._getDistName('img',name)
                return res.replace(name,distName)
            else
                return res

    # 替换css中的背景图片为动态请求
    _replaceBgUri: (source)->
        return source.replace REGEX.cssBg,(str)->
            val = str.replace REGEX.bgUrl,($1)->
                img = $1.replace(/[\(\)'"]/g,"")
                if $1.indexOf('/global/img/') != -1
                    img = img.replace(/\/\w+\/img/,'img')
                    return "('\"+lib.globalUri(\"#{img}\")+\"')"
                else
                    img = img.replace /\/\w+\/img/,'img'
                    return "('\"+lib.widgetUri(\"#{img}\")+\"')"
            return val

    ###*
    * npm版本比较
    * Compares two software version numbers (e.g. "1.7.1" or "1.2.1").
    *
    * @parse string newVer eg:"1.1","1.0.2","1.0.2.0"
    * @parse string oldVer
    * @return <,return -1
    *         =,return 0
    *         >,return 1
    * eg:
    *   compareVersion("0.0.2","0.0.1") //1
    *   compareVersion("0.0.3","0.0.3") //0
    *   compareVersion("0.2.0","1.0.0") //-1
    *   compareVersion("1.0.0","0.9.0") //1
    *   compareVersion('0.0.2.2.0',"0.0.2.3") //-1
    *   compareVersion('0.0.2.0',"0.0.2") //-1
    *   compareVersion('0.0.2',"0.0.2.0") //-1
    ###
    compareVer: (newVer,oldVer)->
        if typeof newVer + typeof oldVer != 'stringstring'
            return false
        if newVer == oldVer
            return 0
        else
            newArr = newVer.split('.')
            oldArr = oldVer.split('.')
            newLen = newArr.length
            oldLen = oldArr.length
            maxLen = Math.max(newLen,oldLen)
            pushZero = ->
                if newArr.length < maxLen
                    newArr.push(0)
                else if oldArr.length < maxLen
                    oldArr.push(0)
                newArr.length != oldArr.length && pushZero()
            newLen != oldLen && pushZero()
            if newArr.toString() == oldArr.toString()
                return if newLen > oldLen then 1 else -1
            else
                isTrue = -1
                compareNum = ->
                    _new = ~~newArr.shift()
                    _old = ~~oldArr.shift()
                    _new > _old && isTrue = 1
                    _new == _old && newArr.length > 0 && compareNum()
                compareNum()
                return isTrue

    _getTagValue: (str)->
        return str.split("[")[1].split("]")[0].replace(/\'/g,"\"")

    _getDepArr: (str)->
        key = "[" + Tools._getTagValue(str) + "]"
        return eval '(' + key + ')'

    tips:(res)->
        log "'" + color.cyan(res.path.replace(root,'')) +  "'","was #{res.type}."

# V1 = "0.0.2.0"
# V2 = "0.0.2"
# log V1 + ':' + V2 + "===>",color.red(Tools.compareVer(V1,V2))
# return false
### ******************** 构建任务 ******************** ###

# 任务列表的容器
taskList = []

# 当前widget Map
widgetMap = {}

# js的依赖
widgetDeps = {}

# js作者的容器
authors = {}
# 版本的容器
emails = {}
# 历史版本的容器
history = {}
# 版本的容器
versions = {}
# js简介的容器
descriptions = {}

# widgetMap file
widgetMapFile = path.join root,'widgetMap.join'

# 任务构建类
class build
    # 参数初始化
    constructor:(@name)->
        @taskName = "widget_#{@name}"
        @srcPath = "./#{@name}/src/"
        @distPath = "./#{@name}/dist/"
        @curPkg = "./#{@name}/pkg.json"
        @env = argv.e

        # 监控的文件
        @files = [
            path.join(@srcPath, '**/*.{less,html}')
            path.join(@srcPath, '**/*.js')
            path.join(@srcPath, '*.js')
            "!" + path.join(@srcPath, '_*.js')
        ]
        @lessFiles = Tools.getFiles(@srcPath + 'less','less')
        @htmlFiles = Tools.getFiles(@srcPath + 'tpl','html')
        @jsModFiles = Tools.getFiles(@srcPath + 'mods','js')

        # 一个js是否存在错误的标记
        # 如果此标记为 false 时，停止后续的构建任务
        @isJsHasNoError = true

        # 初始化 pkg 参数
        widgetMap[@taskName] = {}
        widgetDeps[@taskName] = {}
        history[@taskName] = {}
        authors[@taskName] = ""
        emails[@taskName] = ""
        versions[@taskName] = ""
        descriptions[@taskName] = ""

        # tpl的容器
        @tplSource = ''
        # css的容器
        @cssSource = ''

    # 获取当前Widget的历史版本
    _getHistory:->
        _this = @
        taskName = _this.taskName
        distPath = _this.distPath
        dirs = Tools.getFolders(distPath)
        dirs.forEach (dir)->
            _dirPath = path.join distPath,dir
            _srcName = path.join _dirPath,'index.js'
            _debugName = Tools._setDegbugPath(path.parse(_srcName))
            _fileCon = Tools.minify Tools.getFileSync(_debugName)
            _hash = Tools.md5(_fileCon)
            _distName = Tools._setDistPath(path.parse(_srcName),_hash)
            history[taskName][dir] =
                hash: _hash
                debugUri: Tools._setDegbugPath(path.parse(_srcName))
                distUri: _distName
            Tools.writeFile(_srcName,_fileCon)
            Tools.writeFile(_distName,_fileCon)

    # 读取js源文件注释中的参数
    _getJsInfo: (file)->
        taskName = @taskName
        return through2.obj (file, enc, callback)->
            source = file.contents.toString()
            try
                # 获取 author
                _matchAu = source.match(/@author\s+\[[\s\S]*?\]/)
                authors[taskName] = if _matchEm then Tools._getTagValue(_matchAu[0]) else argv.author

                # 获取 author
                _matchEm = source.match(/@email\s+\[[\s\S]*?\]/)
                emails[taskName] = if _matchEm then Tools._getTagValue(_matchEm[0]) else argv.email

                # 获取description
                _ver = source.match(/@version\s+\[[\s\S]*?\]/)[0]
                versions[taskName] = Tools._getTagValue(_ver)

                # 获取description
                _desc = source.match(/@description\s+\[[\s\S]*?\]/)[0]
                descriptions[taskName] = Tools._getTagValue(_desc)

                # 获取global deps
                _global = source.match(/@require_global\s+\[[\s\S]*?\]/)[0]
                widgetDeps[taskName].global = Tools._getDepArr(_global)

                # 获取widget deps
                _widget = source.match(/@require_widget\s+\[[\s\S]*?\]/)[0]
                widgetDeps[taskName].widget = Tools._getDepArr(_widget)

            catch error
                log "'" + color.red(taskName) + "'",error
            return callback(null,file)

    # 获取js子模块的内容队列
    _getJsMods: ->
        _this = @
        fileCon = []
        _this.jsModFiles.length > 0 && _this.jsModFiles.forEach (val)->
                fileCon.push Tools.getFileSync(val)
        return fileCon

    # 合并js依赖的子模块
    _comboJs: ->
        _this = @
        combos = []
        return through2.obj (file, enc, callback)->
            if file.isNull()
                return callback(null, file)
            else if file.isStream()
                throw new Error('Streams are not supported!')
            try
                jsModSource = _this._getJsMods()
                _this.cssSource && combos.push(_this.cssSource)
                _this.tplSource && combos.push(_this.tplSource)

                combos = combos.concat(jsModSource)
                combos.push(file.contents.toString())
                jsCon = combos.join('\n')
                file.contents = new Buffer(jsCon)
                return callback(null,file)
            catch error
                return callback(new PluginError('catchError',err))

    # 生成debug状态下的index.js文件名
    _debugJs: ->
        _this = @
        taskName = _this.taskName
        return through2.obj (file, enc, callback)->
            try
                source = file.contents.toString()
                version = versions[_this.taskName]
                debugPath = Tools._setDegbugPath(path.parse(file.relative))
                file.path = path.join _this.distPath,version,debugPath
                widgetMap[taskName].version = versions[taskName]
                widgetMap[taskName].debugUri = file.path
                return callback(null,file)
            catch error
                _this.isJsHasNoError = false
                return callback(new PluginError('catchError',err))

    # 压缩index.js
    _miniJs: ->
        _this = @
        return through2.obj (file, enc, callback)->
            try
                file.contents = new Buffer(Tools.minify(file.contents.toString()))
                srcName = Tools._setSrcPath(path.parse(file.relative))
                file.path = path.join _this.distPath,srcName
                return callback(null,file)
            catch err
                _this.isJsHasNoError = false
                return callback(new PluginError('catchError',err))

    # 给压缩后的index.js加上md5戳
    _renameJs: ->
        _this = @
        taskName = _this.taskName
        return through2.obj (file, enc, callback)->
            try
                hash = Tools.md5 file.contents.toString()
                distName = Tools._setDistPath(path.parse(file.relative),hash)
                file.path = path.join _this.distPath,distName
                widgetMap[taskName].distUri = file.path
                widgetMap[taskName].hash = hash
                return callback(null,file)
            catch err
                return callback(new PluginError('catchError',err))

    # 校验js语法
    jsHint: (cb)->
        _this = @
        _cb = cb or ->
        _jsFiles = [
            path.join(_this.srcPath, '**/*.js')
            path.join(_this.srcPath, '*.js')
            "!" + path.join(@srcPath, '_*.js')
        ]
        gulp.src _jsFiles
            .pipe through2.obj (file, enc, callback)->
                _source = file.contents.toString()
                fileName = file.path.toString().split('widget/')[1]
                try
                    log '\'' + color.cyan(fileName) + '\'',color.yellow("语法检测开始:")
                    # console.log _source
                    !!JSHINT(_source)
                    JSHINT.errors.filter (error)->
                        if error && error.code && error.code not in ['W093','W030']
                            # log error
                            log "error in line:",color.magenta(error.line)
                            log "error massage:",color.yellow(error.reason)
                    log '\'' + color.cyan(fileName) + '\'',color.green("语法检测结束!")
                    return callback(null,file)
                catch err
                    _this.isJsHasNoError = false
                    return callback(new PluginError('catchError',err))
            .on 'end', ->
                _cb()
    # js构建
    js: (cb)->
        _this = @
        _cb = cb or ->
        gulp.src path.join(_this.srcPath, 'index.js')
            .pipe plumber({errorHandler: Tools.errHandler})
            .pipe _this._getJsInfo()
            .pipe _this._comboJs()
            .pipe _this._debugJs()
            .pipe gulp.dest(_this.distPath)
            .pipe gulpIg.exclude(_this.env == 'local')
            .pipe _this._miniJs()
            .pipe gulp.dest(_this.distPath)
            .pipe _this._renameJs()
            .pipe gulp.dest(_this.distPath)
            .on 'end', ->
                _cb()

    html: (cb)->
        _this = @
        _cb = cb or ->
        tplPath = _this.srcPath + 'tpl'
        modName = _this.taskName
        tplData = {}
        num = 0
        try
            fs.readdirSync(tplPath).forEach (file)->
                _filePath = path.join(tplPath, file)
                if fs.statSync(_filePath).isFile() and file.indexOf('.html') != -1 and file.indexOf('.') != 0
                    num++
                    fileName = path.basename(file,'.html')
                    source = fs.readFileSync(_filePath, 'utf8')
                    tplData[fileName] = Tools.minify(source,'html')
            if num > 0
                _this.tplSource = "(function(lib){\n    lib.#{modName}_tpl = #{JSON.stringify(tplData)};\n    return lib;\n})(window.#{globalNameSpace}||(window.#{globalNameSpace}={}));"
                # fs.writeFileSync path.join(_this.srcPath,"_tpl.js"), tplSource, 'utf8'
                # log 'tplTojs done!'
            else
                log 'no tpl todo!'
            _cb()
        catch error
            log error

    # less构建
    less: (cb)->
        _this = @
        _cb = cb or ->
        cssCon = []
        modName = _this.taskName
        gulp.src _this.srcPath + 'less/*.less'
            .pipe plumber({errorHandler: Tools.errHandler})
            .pipe less
                compress: false
            .pipe autopre()
            .on 'data',(res)->
                cssCon.push res.contents.toString()
            .on 'end', ->
                try
                    res = Tools.minify(cssCon.join('\n'),'css')
                    cssSource = "(function(lib){\n    var _css = \"#{res}\";\n    lib.#{modName}_css = _css;\n    return lib;\n})(window.#{globalNameSpace}||(window.#{globalNameSpace}={}));"
                    _this.cssSource = Tools._replaceBgUri(cssSource)
                    # Tools.writeFile(_this.srcPath + "_css.js",cssSource)
                    _cb()
                catch error
                    log error
                    cb(error)

    # 读取上一次保存的 pkg.json
    getPkg: ->
        return Tools.getJSONSync(@curPkg)

    # 设置 pkg.json
    setPkg: ->
        @_getHistory()
        taskName = @taskName
        _oldPkg = @getPkg()

        # 如果命令不带版本参数，则赋值上次的版本
        # 如果上次的版本不存在，则默认值为 ‘0.0.1’
        _oldPkg.version = '0.0.1' if !_oldPkg.version

        # 比较前后两个版本
        _isNewVersion = Tools.compareVer(versions[taskName],_oldPkg.version)

        # 设置新的pkg
        _pkg = {}
        _pkg.name = taskName
        if _isNewVersion > -1
            if _.isEmpty(_oldPkg)
                _pkg = _.assing _oldPkg,_pkg
            else
                _pkg.version = versions[taskName]
                _pkg.description = descriptions[taskName]
                _pkg.author = authors[taskName]
                _pkg.email = emails[taskName]
            _pkg.hash = widgetMap[taskName].hash
            _pkg.distUri = widgetMap[taskName].distUri
            _pkg.debugUri = history[taskName][versions[taskName]].debugUri
            _pkg.deps = widgetDeps[taskName]
            _pkg.history = history[taskName]
            Tools.writeFile @curPkg,JSON.stringify(_pkg,null,4)
            widgetMap[taskName].deps = widgetDeps[taskName]
            widgetMap[taskName].history = history[taskName]
        else
            log "'" + color.cyan(_pkg.name) + "'","版本不能低于","'" + color.red(_oldPkg.version) + "'"

    # 注册gulp任务
    registTask: =>
        _this = @
        _defTask = []
        taskName = _this.name
        taskList.push taskName
        if _this.htmlFiles.length > 0
            gulp.task "#{taskName}_html",->
                _this.html()
            _defTask.push("#{taskName}_html")

        if _this.lessFiles.length > 0
            gulp.task "#{taskName}_less",->
                _this.less()
            _defTask.push("#{taskName}_less")

        gulp.task "#{taskName}_jsHint",_defTask,->
            _this.jsHint() if _this.env is 'local'

        gulp.task "#{taskName}_js",["#{taskName}_jsHint"],->
            _this.js()

        gulp.task "#{taskName}_pkg",["#{taskName}_js"],->
            _this.isJsHasNoError or log color.red("#{taskName} 组件存在语法错误")
            _this.setPkg()

        gulp.task "#{taskName}_watch",->
            gulp.watch _this.files,(res)->
                Tools.tips(res)
                try
                    _ext = path.extname(res.path).replace(/^\./,'')
                    _task = "#{taskName}_#{_ext}"
                    gulp.start(_task)
                catch error
                    log error

        gulp.task taskName,["#{taskName}_pkg"],->
            gulp.start("#{taskName}_watch") if _this.env is 'local'

# 生成widget项目的全部task
(->
    blocks = Tools.getFolders(root)
    blocks.forEach (block)->
        if block not in defaultTasks and block isnt 'node_modules'
            new build(block).registTask()
)()

# 生成全部map
gulp.task "map",->
    oldMap = Tools.getJSONSync widgetMapFile
    newMap = _.assign {},oldMap,widgetMap
    # console.log newMap
    Tools.writeFile(widgetMapFile,JSON.stringify(newMap,null,4))

# 定义 启动任务
if tasks.length == 0
    gulp.task 'default',->
        console.log "请设置需要构建的项目: ",taskList.concat(['public'])
else if tasks.shift() == 'public'
    # log color.red(tasks.length)
    if tasks.length == 0
        gulp.task 'public',->
            tasks.length == 0 && log "请设置需要发布的项目: ",taskList.concat('all')
    else
        if tasks[0] == 'all'
            # console.log taskList
            gulp.task 'all',taskList
            gulp.task 'public',['all'],->
                gulp.start 'map' #if argv.e is 'local'
        else
            gulp.task 'public',tasks,->
