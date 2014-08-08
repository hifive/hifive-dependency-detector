//-------------------------------------
// インポート
//-------------------------------------
http = require('http');
fs = require('fs');
path = require('path');

//-------------------------------------
// Private
//-------------------------------------
/**
 * filepathがディレクトリかどうか
 *
 * @param filepath
 * @returns
 */
function isDir(filepath) {
	if (/\/$/.test(filepath)) {
		filepath = filepath.substr(0, filepath.lastIndexOf('/') - 1);
	}
	return (path.existsSync(filepath) && fs.statSync(filepath).isDirectory());
}

/**
 * filepathが".js"で終わるファイルかどうか
 *
 * @param filepath
 * @returns
 */
function isJsFile(filepath) {
	return fs.statSync(filepath).isFile() && /.*\.js$/.test(filepath);
}

//-------------------------------------
// Functions
//-------------------------------------

/**
 * ディレクトリ内にあるファイルのパスを再帰的に列挙して返す
 *
 * @param dir
 * @returns {Array}
 */
function enumerateFiles(dir) {
	var fileList = [];
	var depth = 0;
	function innerExec(d) {
		var files = fs.readdirSync(d);
		for (var i = 0, l = files.length; i < l; i++) {
			var file = d + '/' + files[i];
			if (isDir(file)) {
				depth++;
				innerExec(file);
			} else if (isJsFile(file)) {
				fileList.push(file);
			}
		}
	}
	innerExec(dir);
	return fileList;
}

/**
 * ファイルを読み込んで、srcMapを返します
 * <p>
 * プロパティ名がファイルパス、値がファイルの中身の文字列となるオブジェクトを返します
 * </p>
 *
 * @param fileList
 * @param encoding ファイルのエンコード(fileList内のファイルを全て同じエンコードで読みます)
 * @returns {Object}
 */
function readFiles(fileList, encoding) {
	var srcMap = {};
	for (var i = 0, l = fileList.length; i < l; i++) {
		var file = fileList[i];
		srcMap[file] = fs.readFileSync(file, encoding);
	}
	return srcMap;
}

//-------------------------------------
//export
//-------------------------------------
functions.enumerateFiles = enumerateFiles;
functions.readFiles = readFiles;
