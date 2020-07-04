let path = require('path');
let JSV = require('JSV').JSV;
let crypto = require('crypto');
let fs = require('fs');
let qs = require('querystring');

exports.logger = require('./_logger.js');
exports.cluster = require('./_cluster.js');
exports.server = require('./_server.js');

let log;
exports.initHelper = ()=>{
  log = global.logger.create('__HELPERS');
  exports.init = require('./_init.js');
  exports.defReqFuncs = require('./_defReqFuncs.js');
}

exports.pathCheck = /[\w\d.\/]*/;
exports.infoApi = [];
exports.i18n = {};

let ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
let ID_LENGTH = 8;
exports.generateId = ()=>{
  let rtn = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    rtn += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return rtn;
};

exports.checkPath = (paths, serverPath, config, type, def)=>{
  if(config[type] && !Array.isArray(config[type])){
    throw 'config.' + type + ' must be Array';
  }

  paths[type] = paths[type] || [];

  if(config[type]){
    paths[type] = paths[type].concat(config[type]);
    delete config[type];
  }

  if(!paths[type].length && def){
    paths[type].push(path.join(serverPath, def));
  }

  paths[type] = paths[type].reduce((res, mpath)=>{
    if(!path.isAbsolute(mpath)){
      mpath = path.join(serverPath, mpath);
    }

    try{
      if(fs.statSync(mpath).isDirectory()){
        if(res.indexOf(mpath) < 0){
          res.push(mpath);
        }
      }
      else{
        console.log(type, 'path', mpath, 'is not directory');
      }
    }catch(e){
      console.log(type, 'path', mpath, 'not created');
    }
    return res;
  }, []);
}

exports.toJson = res=>{
  try{
    res.data = JSON.stringify(res.data);
    res.headers['Content-Type'] = 'application/json';
  }catch(e){
    log.e('toJson.JSON.stringify error', e, 'on obj', res);
  }
};

exports.clearObj = (obj, toRemove)=>{
  if(!obj){
    return '{}';
  }

  try{
    let clonedObject = JSON.parse(JSON.stringify(obj));
    if(Array.isArray(toRemove)){
      for(let i in toRemove){
        if(!toRemove.hasOwnProperty(i)){
          continue;
        }
        delete clonedObject[toRemove[i]];
      }
    }
    return JSON.stringify(clonedObject);
  }catch(e){
    log.e('clearObj.JSON.stringify error', e, 'on obj', obj);
    return '';
  }
};

exports.timeout = (config, meta, cb)=>{
  var called = false;

  global.intervals.add((del)=>{
    del();
    if(!called){
      called = true;
      return cb('TIMEOUT', null, 408);
    }
  }, meta.timeout || config.timeout || 60);

  return (...args)=>{
    if(called){
      log.e('request ended', args);
      return;
    }

    called = true;
    return cb(...args);
  };
};

exports.auth = (module, request)=>{
  if(module.auth/* || module.rights*/){
    let header = request.headers.authorization || '';
    let token = header.split(/\s+/).pop() || '';
    let auth = Buffer.from(token, 'base64').toString();
    //let parts = auth.split(':');
    auth = crypto.createHash('md5').update(auth).digest('hex');
    let moduleAuth = module.auth == 'default' && exports.defaultAuth ? exports.defaultAuth : module.auth;

    if(moduleAuth !== true && moduleAuth != auth){
      return false;
    }
  }

  return true;
};

exports.parsePost = function(reqObj, request, cb){
  if(!reqObj.isPost){
    return cb();
  }

  let body = '';

  request.on('data', data=>{
    body += data;

    if(body.length > 1e6){
      request.connection.destroy();
      return cb('POST TOO BIG');
    }
  });

  request.on('end', ()=>{
    try{
      reqObj.post = JSON.parse(body);
    }catch(e){
      try{
        reqObj.post = qs.parse(body);
      }catch(ee){
        reqObj.post = body;
      }
    }


    return cb();
  });
};

let regs = {
  num: /^[\d\.\,]*$/,
  bool: /^(true|false)$/
};
exports.isBoolean = val=>{
  if(String(val).toLowerCase().match(regs.bool)){
    return true;
  }
  
  return false;
};

exports.JSV = (params, schema, envId)=>{
  var env = JSV.createEnvironment(envId);
  return env.validate(params, schema);
};

exports.mime = function(file, fallback){
  return exports.mimeTypes[path.extname(file).toLowerCase()] || fallback || 'application/octet-stream';
};

// List of most common mime-types, stolen from Rack.
exports.mimeTypes  = { 
  '.3gp': 'video/3gpp',
  '.a': 'application/octet-stream',
  '.ai': 'application/postscript',
  '.aif': 'audio/x-aiff',
  '.aiff': 'audio/x-aiff',
  '.asc': 'application/pgp-signature',
  '.asf': 'video/x-ms-asf',
  '.asm': 'text/x-asm',
  '.asx': 'video/x-ms-asf',
  '.atom': 'application/atom+xml',
  '.au': 'audio/basic',
  '.avi': 'video/x-msvideo',
  '.bat': 'application/x-msdownload',
  '.bin': 'application/octet-stream',
  '.bmp': 'image/bmp',
  '.bz2': 'application/x-bzip2',
  '.c': 'text/x-c',
  '.cab': 'application/vnd.ms-cab-compressed',
  '.cc': 'text/x-c',
  '.chm': 'application/vnd.ms-htmlhelp',
  '.class': 'application/octet-stream',
  '.com': 'application/x-msdownload',
  '.conf': 'text/plain',
  '.cpp': 'text/x-c',
  '.crt': 'application/x-x509-ca-cert',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.cxx': 'text/x-c',
  '.deb': 'application/x-debian-package',
  '.der': 'application/x-x509-ca-cert',
  '.diff': 'text/x-diff',
  '.djv': 'image/vnd.djvu',
  '.djvu': 'image/vnd.djvu',
  '.dll': 'application/x-msdownload',
  '.dmg': 'application/octet-stream',
  '.doc': 'application/msword',
  '.dot': 'application/msword',
  '.dtd': 'application/xml-dtd',
  '.dvi': 'application/x-dvi',
  '.ear': 'application/java-archive',
  '.eml': 'message/rfc822',
  '.eps': 'application/postscript',
  '.exe': 'application/x-msdownload',
  '.f': 'text/x-fortran',
  '.f77': 'text/x-fortran',
  '.f90': 'text/x-fortran',
  '.flv': 'video/x-flv',
  '.for': 'text/x-fortran',
  '.gem': 'application/octet-stream',
  '.gemspec': 'text/x-script.ruby',
  '.gif': 'image/gif',
  '.gz': 'application/x-gzip',
  '.h': 'text/x-c',
  '.hh': 'text/x-c',
  '.htm': 'text/html',
  '.html': 'text/html',
  '.ico': 'image/vnd.microsoft.icon',
  '.ics': 'text/calendar',
  '.ifb': 'text/calendar',
  '.iso': 'application/octet-stream',
  '.jar': 'application/java-archive',
  '.java': 'text/x-java-source',
  '.jnlp': 'application/x-java-jnlp-file',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.log': 'text/plain',
  '.m3u': 'audio/x-mpegurl',
  '.m4v': 'video/mp4',
  '.man': 'text/troff',
  '.mathml': 'application/mathml+xml',
  '.mbox': 'application/mbox',
  '.mdoc': 'text/troff',
  '.me': 'text/troff',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.mime': 'message/rfc822',
  '.mml': 'application/mathml+xml',
  '.mng': 'video/x-mng',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.mp4v': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.ms': 'text/troff',
  '.msi': 'application/x-msdownload',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ogg': 'application/ogg',
  '.p': 'text/x-pascal',
  '.pas': 'text/x-pascal',
  '.pbm': 'image/x-portable-bitmap',
  '.pdf': 'application/pdf',
  '.pem': 'application/x-x509-ca-cert',
  '.pgm': 'image/x-portable-graymap',
  '.pgp': 'application/pgp-encrypted',
  '.pkg': 'application/octet-stream',
  '.pl': 'text/x-script.perl',
  '.pm': 'text/x-script.perl-module',
  '.png': 'image/png',
  '.pnm': 'image/x-portable-anymap',
  '.ppm': 'image/x-portable-pixmap',
  '.pps': 'application/vnd.ms-powerpoint',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.ps': 'application/postscript',
  '.psd': 'image/vnd.adobe.photoshop',
  '.py': 'text/x-script.python',
  '.qt': 'video/quicktime',
  '.ra': 'audio/x-pn-realaudio',
  '.rake': 'text/x-script.ruby',
  '.ram': 'audio/x-pn-realaudio',
  '.rar': 'application/x-rar-compressed',
  '.rb': 'text/x-script.ruby',
  '.rdf': 'application/rdf+xml',
  '.roff': 'text/troff',
  '.rpm': 'application/x-redhat-package-manager',
  '.rss': 'application/rss+xml',
  '.rtf': 'application/rtf',
  '.ru': 'text/x-script.ruby',
  '.s': 'text/x-asm',
  '.sgm': 'text/sgml',
  '.sgml': 'text/sgml',
  '.sh': 'application/x-sh',
  '.sig': 'application/pgp-signature',
  '.snd': 'audio/basic',
  '.so': 'application/octet-stream',
  '.svg': 'image/svg+xml',
  '.svgz': 'image/svg+xml',
  '.swf': 'application/x-shockwave-flash',
  '.t': 'text/troff',
  '.tar': 'application/x-tar',
  '.tbz': 'application/x-bzip-compressed-tar',
  '.tcl': 'application/x-tcl',
  '.tex': 'application/x-tex',
  '.texi': 'application/x-texinfo',
  '.texinfo': 'application/x-texinfo',
  '.text': 'text/plain',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.torrent': 'application/x-bittorrent',
  '.tr': 'text/troff',
  '.txt': 'text/plain',
  '.vcf': 'text/x-vcard',
  '.vcs': 'text/x-vcalendar',
  '.vrml': 'model/vrml',
  '.war': 'application/java-archive',
  '.wav': 'audio/x-wav',
  '.wma': 'audio/x-ms-wma',
  '.wmv': 'video/x-ms-wmv',
  '.wmx': 'video/x-ms-wmx',
  '.wrl': 'model/vrml',
  '.wsdl': 'application/wsdl+xml',
  '.xbm': 'image/x-xbitmap',
  '.xhtml': 'application/xhtml+xml',
  '.xls': 'application/vnd.ms-excel',
  '.xml': 'application/xml',
  '.xpm': 'image/x-xpixmap',
  '.xsl': 'application/xml',
  '.xslt': 'application/xslt+xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.zip': 'application/zip',
  '.webp': 'image/webp'
};