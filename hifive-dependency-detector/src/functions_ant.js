//-------------------------------------
// インポート
//-------------------------------------
importClass(java.io.File);
importClass(java.io.FileReader);
importClass(java.io.BufferedReader);
importClass(Packages.org.apache.commons.io.FileUtils);

//-------------------------------------
// Functions
//-------------------------------------

/**
 * ディレクトリ内にあるファイルのパスを再帰的に列挙して返す
 *
 * @param dir
 * @param fileList
 * @returns {Array}
 */
function enumerateFiles(dir, callback) {
	var fileList = [];
	function innerExec(d) {
		var files = new File(d).listFiles();
		for (var i = 0, l = files.length; i < l; i++) {
			var file = files[i];
			if (file.isDirectory()) {
				innerExec(file);
				continue;
			}
			fileList.push(file.getPath());
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
	var length = fileList.length;
	for (var i = 0; i < length; i++) {
		var file = fileList[i];
		var text = FileUtils.readFileToString(new File(file), "utf-8");
		print('[読み込み完了] ' + file);
		srcMap[file] = '' + text;
	}
	return srcMap;
}

//-------------------------------------
// export
//-------------------------------------
functions.enumerateFiles = enumerateFiles;
functions.readFiles = readFiles;
