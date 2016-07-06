import Promise from "bluebird";
import fs_origin from "fs";
import { js_beautify } from "js-beautify";
import path from "path";

var fs = Promise.promisifyAll(fs_origin);

var _MODULES = [];

if (process.argv[2]) {
	console.log('start bundling: ' + process.argv[2]);
	pack(process.argv[2]);
} else {
	console.log('No file input!');
}

var outputFile = process.argv[3] || 'bundle.js';

function pack(fileName) {
	var name = fileName.replace('/\.js/', '');
	var moduleTemplate = 'function(module, exports, require, global) {\n{{moduleContent}}\n}';
	bundleModule(fileName, './')
		.then(() => Promise.map(_MODULES, replaceRequireWithID))
		.then(moduleContents => (
			'[' +
				moduleContents.map(content => moduleTemplate.replace("{{moduleContent}}", content)).join(',\n') +
			']'
		))
		.then(modules => (
			fs.readFileAsync('packSource.js', 'utf-8')
				.then(content => content + "(" + modules + ")")
		))
		.then(js_beautify)
        .then(log)
        .then(result => fs.writeFileAsync(outputFile, result))
        .then(() => console.log("bundle success!"));
}

function bundleModule(moduleName, dirName) {
	console.log("reading :", path.normalize(dirName + moduleName + '.js'));
    return fs.readFileAsync(path.normalize(dirName + moduleName + '.js'), 'utf-8')
        .then(contents => {
            _MODULES.push(path.normalize(dirName + moduleName))
            return contents;
        })
        .then(contents => matchRequire(contents))
        .then(requires => {
            if (requires.length > 0) {
                return Promise.map(requires, (requireName => (
                    bundleModule(requireName, path.dirname(dirName + moduleName) + "/")
                )))
            } else {
                return Promise.resolve();
            }
        })
}

function replaceRequireWithID(moduleName) {
	var dirPath = path.dirname(moduleName) + '/';
	return fs.readFileAsync(moduleName + '.js', 'utf-8')
		.then(code => {
			matchRequire(code).forEach(item => {
                var regRequire = new RegExp(
                    "require\\(\"" + item + "\"\\)|" +
                    "require\\(\'" + item + "\'\\)"
                );
                var modulePath = path.normalize(dirPath + item);
                var moduleID = _MODULES.indexOf(modulePath);
                code = code.replace(regRequire, "require(" + moduleID + ")");
            })
            return code;
		})
}

function matchRequire(code) {
	var requires = code.match(/require\("\S*"\)|require\('\S*'\)/g) || [];
	return requires.map(item => item.match(/"\S*"|'\S*'/)[0]).map(item => item.substring(1, item.length - 1));
}

function log(a) {
    console.log(a);
    return a;
}