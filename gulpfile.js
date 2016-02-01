
/**
 * TMS-black模块开发构建工具
 * @author [Pang.J.G]
 * @version [0.0.1]
 * @date  [2016-01-20 00:01:12]
 * @required [gulp]
 */
var CleanCSS, JSHINT, PluginError, REGEX, Tools, argv, authors, autopre, build, color, crypto, defaultTasks, descriptions, emails, error, fs, globalNameSpace, gulp, gulpIf, gulpIg, gutil, history, less, log, path, plumber, root, taskList, tasks, through2, uglify, versions, widgetDeps, widgetMap, widgetMapFile, yargs, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

fs = require('fs');

path = require('path');

gulp = require('gulp');

gulpIf = require('gulp-if');

gulpIg = require('gulp-ignore');

_ = require('lodash');

crypto = require('crypto');

yargs = require('yargs');

less = require('gulp-less');

uglify = require('uglify-js');

autopre = require('gulp-autoprefixer');

plumber = require('gulp-plumber');

JSHINT = require('jshint').JSHINT;

gutil = require('gulp-util');

log = gutil.log;

color = gutil.colors;

PluginError = gutil.PluginError;

CleanCSS = require('clean-css');

through2 = require('through2');

argv = yargs.option("e", {
  alias: 'env',
  demand: true,
  "default": 'local',
  describe: color.cyan('项目的运行环境'),
  type: 'string'
}).option("author", {
  "default": 'lmtdit',
  describe: color.cyan('设置项目的作者'),
  type: 'string'
}).option("email", {
  "default": 'lmtdit@gmail.com',
  describe: color.cyan('设置项目作者的email'),
  type: 'string'
}).option("hash", {
  alias: 'hashlen',
  "default": 10,
  describe: color.cyan('设置生产文件名的hash长度'),
  type: 'number'
}).option("cdn", {
  "default": '',
  describe: color.cyan('设置项目发布的cdn域名'),
  type: 'string'
}).help('h').alias('h', 'help').argv;

tasks = argv._.concat([]);

globalNameSpace = '_LIB_';

root = process.env.INIT_CWD;

defaultTasks = ['less', 'js', 'watch', 'default', 'public', 'public-all'];

global.Cache = {};

try {
  global.Cache = require('../global/globalMap.json');
} catch (_error) {
  error = _error;
}

REGEX = {
  uri: /globalUri\(('|")([^'|^"]*)(\w+).(png|gif|jpg|html|js|css)('|")\)/g,
  uriVal: /\([\s\S]*?\)/,
  cssBg: /url\([\S\s]*?\)/g,
  bgUrl: /\([\s\S]*?.(png|jpg|gif)\)/
};


/* ******************** base functions ******************** */

Tools = {
  md5: function(source) {
    var _buf, _str;
    _buf = new Buffer(source);
    _str = _buf.toString("binary");
    return crypto.createHash('md5').update(_str, 'utf8').digest('hex');
  },
  mkdirsSync: function(dirpath, mode) {
    if (fs.existsSync(dirpath)) {
      return true;
    } else {
      if (Tools.mkdirsSync(path.dirname(dirpath), mode)) {
        fs.mkdirSync(dirpath, mode);
        return true;
      }
    }
  },
  errHandler: function(e, cb) {
    gutil.beep();
    gutil.beep();
    return log(e);
  },
  minify: function(source, type) {
    var cssOpt, mangled;
    type = type || "js";
    switch (type) {
      case 'css':
        cssOpt = {
          keepBreaks: false,
          compatibility: {
            properties: {
              iePrefixHack: true,
              ieSuffixHack: true
            }
          }
        };
        mangled = new CleanCSS(cssOpt).minify(source);
        source = mangled.styles.replace(/\/\*([\s\S]*?)\*\//g, '');
        break;
      case 'js':
        source = Tools._replaceUriValue(source);
        mangled = uglify.minify(source, {
          fromString: true
        });
        source = mangled.code;
        break;
      case 'html':
        source = source.replace(/<!--([\s\S]*?)-->/g, '').replace(/\/\*([\s\S]*?)\*\//g, '').replace(/^\s+$/g, '').replace(/\n/g, '').replace(/\t/g, '').replace(/\r/g, '').replace(/\n\s+/g, ' ').replace(/\s+/g, ' ').replace(/>([\n\s+]*?)</g, '><');
    }
    return source;
  },
  getFileSync: function(file, encoding) {
    var fileCon, stats, _encoding;
    _encoding = encoding || 'utf8';
    fileCon = '';
    if (fs.existsSync(file)) {
      stats = fs.statSync(file);
      if (stats.isFile()) {
        fileCon = fs.readFileSync(file, _encoding);
      }
    }
    return fileCon;
  },
  getJSONSync: function(file) {
    var data, e, fileCon;
    fileCon = Tools.getFileSync(file);
    data = {};
    if (fileCon) {
      fileCon = fileCon.replace(/\/\/[^\n]*/g, '');
      try {
        data = JSON.parse(fileCon);
      } catch (_error) {
        e = _error;
        console.log(e);
      }
    }
    return data;
  },
  writeFile: function(file, source, offlog) {
    var name;
    name = path.basename(file);
    if (fs.existsSync(file) && Tools.md5(Tools.getFileSync(file)) === Tools.md5(source)) {
      return false;
    }
    Tools.mkdirsSync(path.dirname(file));
    fs.writeFileSync(file, source, 'utf8');
    return offlog || log("'" + color.cyan(file) + "'", "build success.");
  },
  getFolders: function(fPath) {
    var folders;
    folders = [];
    try {
      fs.readdirSync(fPath).forEach(function(v) {
        var folder;
        folder = path.join(fPath, v);
        if (fs.statSync(folder).isDirectory() && v.indexOf('.') !== 0) {
          return folders.push(v);
        }
      });
    } catch (_error) {
      error = _error;
    }
    return folders;
  },
  getFiles: function(fPath, type) {
    var list;
    list = [];
    try {
      fs.readdirSync(fPath).forEach(function(v) {
        var file;
        file = path.join(fPath, v);
        if (fs.existsSync(file) && v.indexOf('.' + type) > 0) {
          return list.push(file);
        }
      });
    } catch (_error) {
      error = _error;
    }
    return list;
  },
  _setDegbugPath: function(parse) {
    parse.base = "_debug." + parse.name + parse.ext;
    return path.format(parse);
  },
  _setSrcPath: function(parse) {
    parse.base = parse.name.replace('_debug.', '') + parse.ext;
    return path.format(parse);
  },
  _setDistPath: function(parse, hash) {
    parse.base = parse.name + "." + hash.substring(0, argv.hash) + parse.ext;
    return path.format(parse);
  },
  _setCacheType: function(parse) {
    return parse.ext.replace('.', '');
  },
  _getDistName: function(type, name) {
    if (_.has(global.Cache, type + "Map") && global.Cache[type + "Map"][name]) {
      return global.Cache[type + "Map"][name].distPath;
    } else {
      return name;
    }
  },
  _replaceUriValue: function(source) {
    return source.replace(REGEX.uri, function(res) {
      var distName, name, type, _val, _valArr;
      _val = res.match(REGEX.uriVal).shift().replace(/[\(\)"']/g, '');
      _valArr = _val.split('/');
      type = _valArr.shift();
      name = _valArr.join('/');
      distName = Tools._getDistName(type, name);
      return res.replace(name, distName);
    });
  },
  _replaceCssBg: function(source) {
    return source.replace(REGEX.cssBg, function(res) {
      var distName, name, _val;
      _val = res.match(REGEX.uriVal).shift().replace(/[\(\)"']/g, '');
      if (_val.indexOf('font/') !== -1) {
        name = _val.split('font/')[1].split(/(\?|#)/)[0];
        distName = Tools._getDistName('font', name);
        return res.replace(name, distName);
      } else if (_val.indexOf('img/') !== -1) {
        name = _val.split('img/')[1];
        distName = Tools._getDistName('img', name);
        return res.replace(name, distName);
      } else {
        return res;
      }
    });
  },
  _replaceBgUri: function(source) {
    return source.replace(REGEX.cssBg, function(str) {
      var val;
      val = str.replace(REGEX.bgUrl, function($1) {
        var img;
        img = $1.replace(/[\(\)'"]/g, "");
        if ($1.indexOf('/global/img/') !== -1) {
          img = img.replace(/\/\w+\/img/, 'img');
          return "('\"+lib.globalUri(\"" + img + "\")+\"')";
        } else {
          img = img.replace(/\/\w+\/img/, 'img');
          return "('\"+lib.widgetUri(\"" + img + "\")+\"')";
        }
      });
      return val;
    });
  },

  /**
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
   */
  compareVer: function(newVer, oldVer) {
    var compareNum, isTrue, maxLen, newArr, newLen, oldArr, oldLen, pushZero;
    if (typeof newVer + typeof oldVer !== 'stringstring') {
      return false;
    }
    if (newVer === oldVer) {
      return 0;
    } else {
      newArr = newVer.split('.');
      oldArr = oldVer.split('.');
      newLen = newArr.length;
      oldLen = oldArr.length;
      maxLen = Math.max(newLen, oldLen);
      pushZero = function() {
        if (newArr.length < maxLen) {
          newArr.push(0);
        } else if (oldArr.length < maxLen) {
          oldArr.push(0);
        }
        return newArr.length !== oldArr.length && pushZero();
      };
      newLen !== oldLen && pushZero();
      if (newArr.toString() === oldArr.toString()) {
        if (newLen > oldLen) {
          return 1;
        } else {
          return -1;
        }
      } else {
        isTrue = -1;
        compareNum = function() {
          var _new, _old;
          _new = ~~newArr.shift();
          _old = ~~oldArr.shift();
          _new > _old && (isTrue = 1);
          return _new === _old && newArr.length > 0 && compareNum();
        };
        compareNum();
        return isTrue;
      }
    }
  },
  _getTagValue: function(str) {
    return str.split("[")[1].split("]")[0].replace(/\'/g, "\"");
  },
  _getDepArr: function(str) {
    var key;
    key = "[" + Tools._getTagValue(str) + "]";
    return eval('(' + key + ')');
  },
  tips: function(res) {
    return log("'" + color.cyan(res.path.replace(root, '')) + "'", "was " + res.type + ".");
  }
};


/* ******************** 构建任务 ******************** */

taskList = [];

widgetMap = {};

widgetDeps = {};

authors = {};

emails = {};

history = {};

versions = {};

descriptions = {};

widgetMapFile = path.join(root, 'widgetMap.join');

build = (function() {
  function build(name) {
    this.name = name;
    this.registTask = __bind(this.registTask, this);
    this.taskName = "widget_" + this.name;
    this.srcPath = "./" + this.name + "/src/";
    this.distPath = "./" + this.name + "/dist/";
    this.curPkg = "./" + this.name + "/pkg.json";
    this.env = argv.e;
    this.files = [path.join(this.srcPath, '**/*.{less,html}'), path.join(this.srcPath, '**/*.js'), path.join(this.srcPath, '*.js'), "!" + path.join(this.srcPath, '_*.js')];
    this.lessFiles = Tools.getFiles(this.srcPath + 'less', 'less');
    this.htmlFiles = Tools.getFiles(this.srcPath + 'tpl', 'html');
    this.jsModFiles = Tools.getFiles(this.srcPath + 'mods', 'js');
    this.isJsHasNoError = true;
    widgetMap[this.taskName] = {};
    widgetDeps[this.taskName] = {};
    history[this.taskName] = {};
    authors[this.taskName] = "";
    emails[this.taskName] = "";
    versions[this.taskName] = "";
    descriptions[this.taskName] = "";
    this.tplSource = '';
    this.cssSource = '';
  }

  build.prototype._getHistory = function() {
    var dirs, distPath, taskName, _this;
    _this = this;
    taskName = _this.taskName;
    distPath = _this.distPath;
    dirs = Tools.getFolders(distPath);
    return dirs.forEach(function(dir) {
      var _debugName, _dirPath, _distName, _fileCon, _hash, _srcName;
      _dirPath = path.join(distPath, dir);
      _srcName = path.join(_dirPath, 'index.js');
      _debugName = Tools._setDegbugPath(path.parse(_srcName));
      _fileCon = Tools.minify(Tools.getFileSync(_debugName));
      _hash = Tools.md5(_fileCon);
      _distName = Tools._setDistPath(path.parse(_srcName), _hash);
      history[taskName][dir] = {
        hash: _hash,
        debugUri: Tools._setDegbugPath(path.parse(_srcName)),
        distUri: _distName
      };
      Tools.writeFile(_srcName, _fileCon);
      return Tools.writeFile(_distName, _fileCon);
    });
  };

  build.prototype._getJsInfo = function(file) {
    var taskName;
    taskName = this.taskName;
    return through2.obj(function(file, enc, callback) {
      var source, _desc, _global, _matchAu, _matchEm, _ver, _widget;
      source = file.contents.toString();
      try {
        _matchAu = source.match(/@author\s+\[[\s\S]*?\]/);
        authors[taskName] = _matchEm ? Tools._getTagValue(_matchAu[0]) : argv.author;
        _matchEm = source.match(/@email\s+\[[\s\S]*?\]/);
        emails[taskName] = _matchEm ? Tools._getTagValue(_matchEm[0]) : argv.email;
        _ver = source.match(/@version\s+\[[\s\S]*?\]/)[0];
        versions[taskName] = Tools._getTagValue(_ver);
        _desc = source.match(/@description\s+\[[\s\S]*?\]/)[0];
        descriptions[taskName] = Tools._getTagValue(_desc);
        _global = source.match(/@require_global\s+\[[\s\S]*?\]/)[0];
        widgetDeps[taskName].global = Tools._getDepArr(_global);
        _widget = source.match(/@require_widget\s+\[[\s\S]*?\]/)[0];
        widgetDeps[taskName].widget = Tools._getDepArr(_widget);
      } catch (_error) {
        error = _error;
        log("'" + color.red(taskName) + "'", error);
      }
      return callback(null, file);
    });
  };

  build.prototype._getJsMods = function() {
    var fileCon, _this;
    _this = this;
    fileCon = [];
    _this.jsModFiles.length > 0 && _this.jsModFiles.forEach(function(val) {
      return fileCon.push(Tools.getFileSync(val));
    });
    return fileCon;
  };

  build.prototype._comboJs = function() {
    var combos, _this;
    _this = this;
    combos = [];
    return through2.obj(function(file, enc, callback) {
      var jsCon, jsModSource;
      if (file.isNull()) {
        return callback(null, file);
      } else if (file.isStream()) {
        throw new Error('Streams are not supported!');
      }
      try {
        jsModSource = _this._getJsMods();
        _this.cssSource && combos.push(_this.cssSource);
        _this.tplSource && combos.push(_this.tplSource);
        combos = combos.concat(jsModSource);
        combos.push(file.contents.toString());
        jsCon = combos.join('\n');
        file.contents = new Buffer(jsCon);
        return callback(null, file);
      } catch (_error) {
        error = _error;
        return callback(new PluginError('catchError', err));
      }
    });
  };

  build.prototype._debugJs = function() {
    var taskName, _this;
    _this = this;
    taskName = _this.taskName;
    return through2.obj(function(file, enc, callback) {
      var debugPath, source, version;
      try {
        source = file.contents.toString();
        version = versions[_this.taskName];
        debugPath = Tools._setDegbugPath(path.parse(file.relative));
        file.path = path.join(_this.distPath, version, debugPath);
        widgetMap[taskName].version = versions[taskName];
        widgetMap[taskName].debugUri = file.path;
        return callback(null, file);
      } catch (_error) {
        error = _error;
        _this.isJsHasNoError = false;
        return callback(new PluginError('catchError', err));
      }
    });
  };

  build.prototype._miniJs = function() {
    var _this;
    _this = this;
    return through2.obj(function(file, enc, callback) {
      var err, srcName;
      try {
        file.contents = new Buffer(Tools.minify(file.contents.toString()));
        srcName = Tools._setSrcPath(path.parse(file.relative));
        file.path = path.join(_this.distPath, srcName);
        return callback(null, file);
      } catch (_error) {
        err = _error;
        _this.isJsHasNoError = false;
        return callback(new PluginError('catchError', err));
      }
    });
  };

  build.prototype._renameJs = function() {
    var taskName, _this;
    _this = this;
    taskName = _this.taskName;
    return through2.obj(function(file, enc, callback) {
      var distName, err, hash;
      try {
        hash = Tools.md5(file.contents.toString());
        distName = Tools._setDistPath(path.parse(file.relative), hash);
        file.path = path.join(_this.distPath, distName);
        widgetMap[taskName].distUri = file.path;
        widgetMap[taskName].hash = hash;
        return callback(null, file);
      } catch (_error) {
        err = _error;
        return callback(new PluginError('catchError', err));
      }
    });
  };

  build.prototype.jsHint = function(cb) {
    var _cb, _jsFiles, _this;
    _this = this;
    _cb = cb || function() {};
    _jsFiles = [path.join(_this.srcPath, '**/*.js'), path.join(_this.srcPath, '*.js'), "!" + path.join(this.srcPath, '_*.js')];
    return gulp.src(_jsFiles).pipe(through2.obj(function(file, enc, callback) {
      var err, fileName, _source;
      _source = file.contents.toString();
      fileName = file.path.toString().split('widget/')[1];
      try {
        log('\'' + color.cyan(fileName) + '\'', color.yellow("语法检测开始:"));
        !!JSHINT(_source);
        JSHINT.errors.filter(function(error) {
          var _ref;
          if (error && error.code && ((_ref = error.code) !== 'W093' && _ref !== 'W030')) {
            log("error in line:", color.magenta(error.line));
            return log("error massage:", color.yellow(error.reason));
          }
        });
        log('\'' + color.cyan(fileName) + '\'', color.green("语法检测结束!"));
        return callback(null, file);
      } catch (_error) {
        err = _error;
        _this.isJsHasNoError = false;
        return callback(new PluginError('catchError', err));
      }
    })).on('end', function() {
      return _cb();
    });
  };

  build.prototype.js = function(cb) {
    var _cb, _this;
    _this = this;
    _cb = cb || function() {};
    return gulp.src(path.join(_this.srcPath, 'index.js')).pipe(plumber({
      errorHandler: Tools.errHandler
    })).pipe(_this._getJsInfo()).pipe(_this._comboJs()).pipe(_this._debugJs()).pipe(gulp.dest(_this.distPath)).pipe(gulpIg.exclude(_this.env === 'local')).pipe(_this._miniJs()).pipe(gulp.dest(_this.distPath)).pipe(_this._renameJs()).pipe(gulp.dest(_this.distPath)).on('end', function() {
      return _cb();
    });
  };

  build.prototype.html = function(cb) {
    var modName, num, tplData, tplPath, _cb, _this;
    _this = this;
    _cb = cb || function() {};
    tplPath = _this.srcPath + 'tpl';
    modName = _this.taskName;
    tplData = {};
    num = 0;
    try {
      fs.readdirSync(tplPath).forEach(function(file) {
        var fileName, source, _filePath;
        _filePath = path.join(tplPath, file);
        if (fs.statSync(_filePath).isFile() && file.indexOf('.html') !== -1 && file.indexOf('.') !== 0) {
          num++;
          fileName = path.basename(file, '.html');
          source = fs.readFileSync(_filePath, 'utf8');
          return tplData[fileName] = Tools.minify(source, 'html');
        }
      });
      if (num > 0) {
        _this.tplSource = "(function(lib){\n    lib." + modName + "_tpl = " + (JSON.stringify(tplData)) + ";\n    return lib;\n})(window." + globalNameSpace + "||(window." + globalNameSpace + "={}));";
      } else {
        log('no tpl todo!');
      }
      return _cb();
    } catch (_error) {
      error = _error;
      return log(error);
    }
  };

  build.prototype.less = function(cb) {
    var cssCon, modName, _cb, _this;
    _this = this;
    _cb = cb || function() {};
    cssCon = [];
    modName = _this.taskName;
    return gulp.src(_this.srcPath + 'less/*.less').pipe(plumber({
      errorHandler: Tools.errHandler
    })).pipe(less({
      compress: false
    })).pipe(autopre()).on('data', function(res) {
      return cssCon.push(res.contents.toString());
    }).on('end', function() {
      var cssSource, res;
      try {
        res = Tools.minify(cssCon.join('\n'), 'css');
        cssSource = "(function(lib){\n    var _css = \"" + res + "\";\n    lib." + modName + "_css = _css;\n    return lib;\n})(window." + globalNameSpace + "||(window." + globalNameSpace + "={}));";
        _this.cssSource = Tools._replaceBgUri(cssSource);
        return _cb();
      } catch (_error) {
        error = _error;
        log(error);
        return cb(error);
      }
    });
  };

  build.prototype.getPkg = function() {
    return Tools.getJSONSync(this.curPkg);
  };

  build.prototype.setPkg = function() {
    var taskName, _isNewVersion, _oldPkg, _pkg;
    this._getHistory();
    taskName = this.taskName;
    _oldPkg = this.getPkg();
    if (!_oldPkg.version) {
      _oldPkg.version = '0.0.1';
    }
    _isNewVersion = Tools.compareVer(versions[taskName], _oldPkg.version);
    _pkg = {};
    _pkg.name = taskName;
    if (_isNewVersion > -1) {
      if (_.isEmpty(_oldPkg)) {
        _pkg = _.assing(_oldPkg, _pkg);
      } else {
        _pkg.version = versions[taskName];
        _pkg.description = descriptions[taskName];
        _pkg.author = authors[taskName];
        _pkg.email = emails[taskName];
      }
      _pkg.hash = widgetMap[taskName].hash;
      _pkg.distUri = widgetMap[taskName].distUri;
      _pkg.debugUri = history[taskName][versions[taskName]].debugUri;
      _pkg.deps = widgetDeps[taskName];
      _pkg.history = history[taskName];
      Tools.writeFile(this.curPkg, JSON.stringify(_pkg, null, 4));
      widgetMap[taskName].deps = widgetDeps[taskName];
      return widgetMap[taskName].history = history[taskName];
    } else {
      return log("'" + color.cyan(_pkg.name) + "'", "版本不能低于", "'" + color.red(_oldPkg.version) + "'");
    }
  };

  build.prototype.registTask = function() {
    var taskName, _defTask, _this;
    _this = this;
    _defTask = [];
    taskName = _this.name;
    taskList.push(taskName);
    if (_this.htmlFiles.length > 0) {
      gulp.task("" + taskName + "_html", function() {
        return _this.html();
      });
      _defTask.push("" + taskName + "_html");
    }
    if (_this.lessFiles.length > 0) {
      gulp.task("" + taskName + "_less", function() {
        return _this.less();
      });
      _defTask.push("" + taskName + "_less");
    }
    gulp.task("" + taskName + "_jsHint", _defTask, function() {
      if (_this.env === 'local') {
        return _this.jsHint();
      }
    });
    gulp.task("" + taskName + "_js", ["" + taskName + "_jsHint"], function() {
      return _this.js();
    });
    gulp.task("" + taskName + "_pkg", ["" + taskName + "_js"], function() {
      _this.isJsHasNoError || log(color.red("" + taskName + " 组件存在语法错误"));
      return _this.setPkg();
    });
    gulp.task("" + taskName + "_watch", function() {
      return gulp.watch(_this.files, function(res) {
        var _ext, _task;
        Tools.tips(res);
        try {
          _ext = path.extname(res.path).replace(/^\./, '');
          _task = "" + taskName + "_" + _ext;
          return gulp.start(_task);
        } catch (_error) {
          error = _error;
          return log(error);
        }
      });
    });
    return gulp.task(taskName, ["" + taskName + "_pkg"], function() {
      if (_this.env === 'local') {
        return gulp.start("" + taskName + "_watch");
      }
    });
  };

  return build;

})();

(function() {
  var blocks;
  blocks = Tools.getFolders(root);
  return blocks.forEach(function(block) {
    if (__indexOf.call(defaultTasks, block) < 0 && block !== 'node_modules') {
      return new build(block).registTask();
    }
  });
})();

gulp.task("map", function() {
  var newMap, oldMap;
  oldMap = Tools.getJSONSync(widgetMapFile);
  newMap = _.assign({}, oldMap, widgetMap);
  return Tools.writeFile(widgetMapFile, JSON.stringify(newMap, null, 4));
});

if (tasks.length === 0) {
  gulp.task('default', function() {
    return console.log("请设置需要构建的项目: ", taskList.concat(['public']));
  });
} else if (tasks.shift() === 'public') {
  if (tasks.length === 0) {
    gulp.task('public', function() {
      return tasks.length === 0 && log("请设置需要发布的项目: ", taskList.concat('all'));
    });
  } else {
    if (tasks[0] === 'all') {
      gulp.task('all', taskList);
      gulp.task('public', ['all'], function() {
        return gulp.start('map');
      });
    } else {
      gulp.task('public', tasks, function() {});
    }
  }
}
