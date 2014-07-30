//-------------------------------------
// Const
//-------------------------------------
/** node.jsで起動するときのサーバのポート。変更する場合はここを修正してください。 */
var PORT = 8081;

// -------------------------------------
// プロジェクト設定
// -------------------------------------
/**
 * 依存関係計算のソースのあるディレクトリ。指定されたフォルダ以下のjsファイルを対象にします。
 * <p>
 * node.jsから実行した場合、この変数に設定された値を使用します。
 * Antからの実行の場合、${src.dir}が設定されていればその設定を使用します。
 * </p>
 */
var srcDir = '../WebContent/app';

/** js解析オブジェクト */
var esprima, estraverse;

/** esprimaのパス */
var PATH_ESPRIMA = 'src/res/lib/esprima/esprima.js';

/** estraversのパス */
var PATH_ESTRAVERSE = 'src/res/lib/estraverse/estraverse.js';

/** NodeJsで使用するクラス */
var http, fs, path;

// -------------------------------------
// 環境設定
// -------------------------------------
/** node.jsでの実行の場合はtrue、そうでない場合はAntからの実行として扱う */
var isNodeJs = !!global.GLOBAL;

/** 出力関数。NodeJsの場合はconsole、Antの場合はechoで出力 */
var print = null;

/** 必要なクラスの取得 */
if (isNodeJs) {
	print = function(msg) {
		console.log(msg);
	};
	http = require('http');
	fs = require('fs');
	path = require('path');
	esprima = require();
	estraverse = require(PATH_ESTRAVERSE);
} else {
	importClass(java.io.File);
	importClass(java.io.FileReader);
	importClass(java.io.BufferedReader);

	print = (function() {
		var echo = MargeSrcBuilder.createTask('echo');
		return function(msg) {
			echo.setMessage(msg);
			echo.perform();
		};
	})();
	require = function(path) {
		eval(''
				+ new java.lang.String(java.nio.file.Files
						.readAllBytes(java.nio.file.Paths.get(path))));
	};
	// 外部jsをインクルード
	require(PATH_ESPRIMA); // esprima
	require(PATH_ESTRAVERSE); // estraverse

	// 呼び出し元Antで定義されたsrc.dirを取得
	srcDir = project.getProperty('src.dir') || srcDir;
}

// -----------------------------------------------------
// シーケンシャル実行
// -----------------------------------------------------
// シーケンシャル実行
var callbacksIndex = 0;
// シーケンシャルに実行する関数リスト
var seq = [ getFileList, parseFile, createDependencyTree ];
// returnResultは必ず最後
seq.push(returnResult);

function next() {
	var callback = seq[callbacksIndex++];
	return callback && callback.apply(this, arguments);
}
function init() {
	callbacksIndex = 0;
}

// -------------------------------------
// Functions
// -------------------------------------
/**
 * ディレクトリ内にあるファイルのパスを再帰的に列挙して返す
 *
 * @param dir
 * @param fileList
 * @returns {Array}
 */
function readDir(dir, callback) {
	var fileList = [];
	if (isNodeJs) {
		var depth = 0;
		function getListFromDir(dir) {
			fs.readdir(dir, function(err, files) {
				if (err) {
					throw err;
				}
				for (var i = 0, l = files.length; i < l; i++) {
					var file = dir + '/' + files[i];
					if (isDir(file)) {
						depth++;
						getListFromDir(file);
					} else if (isJsFile(file)) {
						fileList.push(file);
					}
				}
				if (depth === 0) {
					callback(fileList);
				}
				depth--;
			});
		}
		getListFromDir(dir);
	} else {
		function innerExec(_dir) {
			var files = new File(_dir).listFiles();
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
		callback(fileList);
	}
}
function isDir(filepath) {
	if (/\/$/.test(filepath)) {
		filepath = filepath.substr(0, filepath.lastIndexOf('/') - 1);
	}
	return (path.existsSync(filepath) && fs.statSync(filepath).isDirectory());
}

function isJsFile(filepath) {
	return fs.statSync(filepath).isFile() && /.*\.js$/.test(filepath);
}

function endsWith(str, suffix) {
	var sub = str.length - suffix.length;
	return (sub >= 0) && (str.lastIndexOf(suffix) === sub);
}

/**
 * SyntaxTreeからリソース名(exposeしている名前空間)を取得
 *
 * @param text
 * @returns {Object}
 */
function createDependsMap(text) {
	// SyntaxTreeをみてexposeされている__nameを取得するようにする
	var dependsMap = {};
	var nameToDefObj = {};
	var tmpDepends = [];
	var tmpDef = null;
	var ast = esprima.parse(text);
	var Syntax = estraverse.Syntax;
	estraverse.traverse(ast, {
		leave : function(node, parent) {
			if (node.type === Syntax.Property && node.key
					&& node.key.name === '__name') {
				var name = node.value.value;
				if (nameToDefObj[name]) {
					throw new Error('同一の名前で定義オブジェクトが複数あります');
				}
				nameToDefObj[name] = parent;
				if (tmpDef === parent) {
					dependsMap[name] = tmpDepends;
					tmpDef = null;
					tmpDepends = [];
				} else {
					dependsMap[name] = [];
				}
				return;
			}
			if (node.type === Syntax.Property
					&& node.value.type === Syntax.CallExpression
					&& node.value.callee.object
					&& node.value.callee.object.object
					&& node.value.callee.object.object.name === 'h5'
					&& node.value.callee.object.property
					&& node.value.callee.object.property.name === 'res'
					&& node.value.callee.property.name === 'require') {
				var val = node.value.arguments[0].value;
				// ejsは除く
				if (val.lastIndexOf('.ejs') === val.length - 4) {
					return;
				}

				var def = parent;
				for ( var name in nameToDefObj) {
					if (nameToDefObj[name] === def) {
						dependsMap[name] = dependsMap[name] || [];
						dependsMap[name].push(val);
						return;
					}
				}
				// 探索しているオブジェクトの__nameが未探索の場合
				tmpDepends.push(val);
				tmpDef = def;
			}
		}
	});
	return dependsMap;
}
/**
 * def以下の各定義オブジェクトについて処理を行う(幅優先)
 *
 * @param def
 * @param func
 */
function doForEachDef(def, func) {
	function innerExec(d, parent) {
		func(d, parent);
		if (typeof d === 'string') {
			return;
		}
		for (var i = 0, l = d.depends.length; i < l; i++) {
			innerExec(d.depends[i], d);
		}
	}
	innerExec(def);
}

/**
 * def以下の各定義オブジェクトについて処理を行う(深さ優先)
 *
 * @param def
 * @param func
 */
function doForEachDefDepthFirst(def, func) {
	function innerExec(d, parent) {
		if (typeof d === 'string') {
			return;
		}
		for (var i = 0, l = d.depends.length; i < l; i++) {
			innerExec(d.depends[i], d);
		}
		func(d, parent);
	}
	innerExec(def);
}

// -----------------------------------------------------
// Body
// -----------------------------------------------------

/**
 * ファイルリスト取得
 */
function getFileList() {
	var depth = 0;
	readDir(srcDir, function(fileList) {
		print('以下のファイルについて、依存関係を計算してマージします');
		print(fileList);
		next(fileList);
	});
}

/**
 * ファイル読み込み
 *
 * @param fileList
 */
function parseFile(fileList) {
	var srcMap = {};
	var length = fileList.length;
	if (isNodeJs) {
		var fileCount = 0;
		for (var i = 0; i < length; i++) {
			(function(file) {
				fs.readFile(file, 'utf8', function(err, text) {
					if (err) {
						throw err;
					}
					srcMap[file] = text;
					fileCount++;
					if (fileCount === length) {
						next(srcMap);
					}
				});
			})(fileList[i]);
		}
	} else {
		for (var i = 0; i < length; i++) {
			var file = fileList[i];
			var br = new BufferedReader(new FileReader(new File(file)));
			var text = '';
			var str;
			while ((str = br.readLine()) != null) {
				text += str;
			}
			br.close();
			print('[読み込み完了] ' + file);
			srcMap[file] = text;
		}
		next(srcMap);
	}
}

/**
 * 依存関係ツリーとソースリストの作成
 *
 * @param srcMap
 */
function createDependencyTree(srcMap) {
	var defs = [];
	var namespaceSrcMap = {};
	for ( var src in srcMap) {
		var text = srcMap[src];
		// exposeされている名前と、その名前(定義オブジェクト)が使用している名前(定義オブジェクト名)のマップを取得
		print('[解析開始] ' + src);
		var dependsMap = createDependsMap(text);
		for ( var name in dependsMap) {
			var depends = dependsMap[name];
			// srcの依存ツリー作成に必要
			namespaceSrcMap[name] = src;

			// 依存定義オブジェクト
			var def = {
				name : name,
				src : src,
				depends : depends
			};

			// 名前(文字列)を{name,src,depends}を持つ依存定義オブジェクトに変更
			for (var i = 0, l = depends.length; i < l; i++) {
				var dependName = depends[i];
				for (var j = 0, len = defs.length; j < len; j++) {
					if (defs[j].name === dependName) {
						depends.splice(i, 1, defs[j]);
					}
				}
			}
			for (var i = 0, l = defs.length; i < l; i++) {
				doForEachDef(defs[i], function(d, parent) {
					if (d === name) {
						parent.depends
								.splice(parent.depends.indexOf(d), 1, def);
					}
				});
			}
			defs.push(def);
		}
	}
	// ツリーの作成
	var dependencyTree = [];
	var currentReferenceable = [];

	/**
	 * @param _def
	 * @returns _defから参照できるdefオブジェクトを列挙した配列
	 */
	function getReferenceable(_def) {
		var ret = [];
		doForEachDef(_def, function(d) {
			ret.push(d);
		});
		return ret;
	}

	for (var i = 0, l = defs.length; i < l; i++) {
		var def = defs[i];
		if (currentReferenceable.indexOf(def) !== -1) {
			// ツリーに追加済みノードから参照できるならツリーに追加しない
			continue;
		}
		// 参照可能ノードに追加
		var referenceable = getReferenceable(def);
		Array.prototype.push.apply(currentReferenceable, referenceable);

		// 追加するノードがツリーのルートにあるノードを参照しているなら、それを消す
		for (var j = 0, len = dependencyTree.length; j < len; j++) {
			if (referenceable.indexOf(dependencyTree[j]) !== -1) {
				dependencyTree.splice(j, 1);
				len--;
				j--;
			}
		}
		// ツリーに追加
		dependencyTree.push(def);
	}

	// ソースの読み込み順を依存関係ツリーから取得
	var srcList = [];
	var checkedDefs = [];
	for (var i = 0, l = dependencyTree.length; i < l; i++) {
		var def = dependencyTree[i];
		if (checkedDefs.indexOf(def) !== -1) {
			continue;
		}
		doForEachDefDepthFirst(def, function(d) {
			if (checkedDefs.indexOf(d) !== -1) {
				return;
			}
			if (srcList.indexOf(d.src) === -1) {
				srcList.push(d.src);
				checkedDefs.push(d);
			}
		});
	}
	next(dependencyTree, srcList);
}

/**
 * 結果をresponseに出力
 *
 * @param dependencyTree
 * @param srcList
 */
function returnResult(dependencyTree, srcList) {
	print('解析が終了しました');

	if (isNodeJs) {
		res.writeHead(200, {
			'Content-Type' : 'application/json'
		});
		res.write('【依存関係に基づいたソースの読み込み順序】\n');
		res.write(JSON.stringify(srcList, null, "    "));
		res.write('\n\n');
		res.write('【依存関係】\n');
		res.write(JSON.stringify(dependencyTree, null, "    "));
		res.end();
	} else {
		// ${srcList}プロパティに代入
		project.setNewProperty('srcList', srcList);
	}
}

// -----------------------------------------------------
// 実行
// -----------------------------------------------------
function main(request, response) {
	print('getSrcList start');
	if (isNodeJs) {
		if (request.url === '/favicon.ico') {
			return;
		}
		req = request;
		res = response;
	}
	init();
	next();
}

if (isNodeJs) {
	console.log('Server running at http://127.0.0.1:' + PORT + '/');
	http.createServer(main).listen(PORT);
} else {
	main();
}
