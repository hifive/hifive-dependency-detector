// -------------------------------------
// プロジェクト設定
// -------------------------------------
/** node.jsで起動するときのサーバのポート。変更する場合はここを修正してください。 */
var PORT = 8081;

/**
 * 依存関係計算のソースのあるディレクトリ。指定されたフォルダ以下のjsファイルを対象にします。
 * <p>
 * node.jsから実行した場合、この変数に設定された値を使用します。 Antからの実行の場合、${src.dir}が設定されていればその設定を使用します。
 * </p>
 */
var srcDir = '../WebContent/app';

/**
 * 依存定義関数名のリスト
 * <p>
 * ここで定義された変数名を使った関数呼び出しを依存定義の呼び出しとみなして、依存関係を解析します。
 * Antから実行する場合は${require.functions}に格納した値を使用します
 * </p>
 * <p>
 * オブジェクトのプロパティにrequireを持つ場合は"."区切りで指定してください。
 * (高速化のためinit()関数内で"."区切りのものはsplit('.')したものに差し替えています)
 * </p>
 */
var requireFunctions = [ 'h5.res.require' ];
// require関数の別名定義
// var requireFunctions = [ 'h5.res.require', 'req', 'util.req' ];

/** js解析オブジェクト */
var esprima, estraverse;

/** esprimaのパス(nodeから実行時用。このjsファイルからの相対パス) */
var PATH_ESPRIMA_NODEJS = './res/lib/esprima/esprima.js';

/** estraversのパス(nodeから実行時用。このjsファイルからの相対パス) */
var PATH_ESTRAVERSE_NODEJS = './res/lib/estraverse/estraverse.js';

/** esprimaのパス(Antからの実行時用。Ant実行xmlファイルからの相対パス) */
var PATH_ESPRIMA_ANT = './src/res/lib/esprima/esprima.js';

/** estraversのパス(Antからの実行時用。Ant実行xmlファイルからの相対パス) */
var PATH_ESTRAVERSE_ANT = './src/res/lib/estraverse/estraverse.js';

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
	esprima = require(PATH_ESPRIMA_NODEJS);
	estraverse = require(PATH_ESTRAVERSE_NODEJS);
} else {
	importClass(java.io.File);
	importClass(java.io.FileReader);
	importClass(java.io.BufferedReader);
	importClass(Packages.org.apache.commons.io.FileUtils);

	print = (function() {
		var echo = MargeSrcBuilder.createTask('echo');
		return function(msg) {
			echo.setMessage(msg);
			echo.perform();
		};
	})();
	require = function(path) {
		var data = java.nio.file.Paths.get(path);
		var content = java.nio.file.Files.readAllBytes(data);
		var str = new java.lang.String(content);
		var src = '' + str;
		eval('' + str);
	};
	// 外部jsをインクルード
	require(PATH_ESPRIMA_ANT); // esprima
	require(PATH_ESTRAVERSE_ANT); // estraverse

	// 呼び出し元Antで定義されたsrc.dirを取得
	srcDir = project.getProperty('src.dir') || srcDir;

	// 呼び出し元Antで定義されたrequire.functions}を取得
	requireFunctions = project.getProperty('require.functions')
			|| requireFunctions;
}

/** estraversのSyntaxオブジェクト */
var Syntax = estraverse.Syntax;

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

/**
 * 指定されたノードがh5.res.requireの呼び出し、またはh5.res.requireが格納されている変数の呼び出しかどうか
 *
 * @param {Node}
 *            node estraverseで解析したノード
 * @returns {Boolean}
 */
function isRequireCalleeNode(node) {
	// 関数呼び出しであること
	if (node.type !== Syntax.CallExpression) {
		return false;
	}
	var callee = node.callee;
	for (var i = 0, l = requireFunctions.length; i < l; i++) {
		var funcName = requireFunctions[i];
		if (typeof funcName === 'string') {
			// オブジェクト区切りでないなら関数名を比較
			if (callee.name === funcName) {
				return isRequireArguments(node.arguments);
			}
		} else {
			// オブジェクト区切りの場合
			var target = callee;
			var isMatch = false;
			for (var index = funcName.length - 1; index >= 0; index--) {
				var expectProp = funcName[index];
				if (index === 0) {
					isMatch = target.name === expectProp;
					break;
				}
				if (!target.property || target.property.name !== expectProp) {
					break;
				}
				target = target.object;
			}
			if (isMatch) {
				return isRequireArguments(node.arguments);
			}
		}
	}
	return false;
}

/**
 * 引数ノードがrequire関数の引数として正しいか
 *
 * @param {Node}
 *            arg argumentsノード
 * @returns {Boolean}
 */
function isRequireArguments(arg) {
	if (arg.length !== 1) {
		return false;
	}
	var val = arg[0] && arg[0].value;
	if (typeof val === 'string' && val.lastIndexOf('.ejs') !== val.length - 4) {
		// 引数は1つでかつ文字列、かつejsファイルじゃないなら依存定義とみなす
		return true;
	}
	return false;
}

/**
 * srcファイルとそのsrcで定義している名前空間の配列、及び依存している名前空間配列のマップを作成して返します
 *
 * @param text
 * @returns {Object} {src:'hoge.js', names:[], depends:[]}
 */
function createSrcInfo(text) {
	// SyntaxTreeをみてexposeされている__nameを取得するようにする
	var names = [];
	var depends = [];
	var srcInfo = {
		names : names,
		depends : depends
	};
	var ast = esprima.parse(text);
	estraverse.traverse(ast, {
		leave : function(node, parent) {
			if (node.type === Syntax.Property && node.key
					&& node.key.name === '__name') {
				var name = node.value.value;
				names.push(name);
				return;
			}
			if (isRequireCalleeNode(node)) {
				var val = node.arguments[0].value;
				// ejsは除く
				if (val.lastIndexOf('.ejs') === val.length - 4) {
					return;
				}
				depends.push(val);
			}
		}
	});
	// 自分のソースファイルで定義されいてるものは除く
	for (var i = 0, l = depends.length; i < l; i++) {
		if (names.indexOf(depends[i]) !== -1) {
			depends.splice(i, 1);
			i--;
			l--;
		}
	}
	return srcInfo;
}

/**
 * jsを解析して、解析結果を返します
 *
 * <p>
 * 以下のようなオブジェクトを返します
 * </p>
 *
 * <pre>
 * {
 * 	srcInfo : jsファイルの情報,
 *  names: jsファイルで定義されている名前空間のリスト
 * 	namespaceInfos : jsファイルから取得した名前空間情報の配列
 * }
 * </pre>
 *
 * @param text
 * @returns {Object}
 *
 */
function createDependsInfoObject(text) {
	var names = [];
	var depends = [];
	var srcInfo = {
		depends : depends
	};

	var nameToDefObj = {};
	var tmpDepends = [];
	var tmpDef = null;
	var namespaceDepensMap = {};

	var ast = esprima.parse(text);
	estraverse.traverse(ast, {
		leave : function(node, parent) {
			if (node.type === Syntax.Property && node.key
					&& node.key.name === '__name') {
				var name = node.value.value;
				names.push(name);

				// 名前空間の依存関係を検出
				nameToDefObj[name] = parent;
				if (tmpDef === parent) {
					namespaceDepensMap[name] = tmpDepends;
					tmpDef = null;
					tmpDepends = [];
				} else {
					namespaceDepensMap[name] = [];
				}
				return;
			}

			// ソースファイル中にrequire呼び出しがある場合、ソース間の依存関係があるとみなす
			if (isRequireCalleeNode(node)) {
				var val = node.arguments[0].value;

				// ejsは除く
				if (val.lastIndexOf('.ejs') === val.length - 4) {
					return;
				}
				depends.push(val);
			}

			// オブジェクト定義の値にrequire呼び出しがある場合はそのオブジェクトが定義されている名前空間と紐づける
			if (node.type === Syntax.Property
					&& isRequireCalleeNode(node.value)) {
				var val = node.value.arguments[0].value;

				var def = parent;
				for ( var name in nameToDefObj) {
					if (nameToDefObj[name] === def) {
						namespaceDepensMap[name] = namespaceDepensMap[name]
								|| [];
						namespaceDepensMap[name].push(val);
						return;
					}
				}
				// 探索しているオブジェクトの__nameが未探索の場合
				// 次に__nameが出てきた時にチェックできるように覚えておく
				tmpDepends.push(val);
				tmpDef = def;
			}

		}
	});
	// srcInfo.dependsについて自分のソースファイルで定義されいてるものは除く
	for (var i = 0, l = depends.length; i < l; i++) {
		if (names.indexOf(depends[i]) !== -1) {
			depends.splice(i, 1);
			i--;
			l--;
		}
	}
	// namespaceInfosの作成
	var namespaceInfos = [];
	for ( var name in namespaceDepensMap) {
		namespaceInfos.push({
			name : name,
			depends : namespaceDepensMap[name]
		});
	}
	return {
		srcInfo : srcInfo,
		names : names,
		namespaceInfos : namespaceInfos
	};
}

/**
 * def以下の各定義オブジェクトについて処理を行う(幅優先)
 *
 * @param def
 * @param func
 */
function doForEachInfosDef(def, func) {
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
function doForEachInfosDefDepthFirst(def, func) {
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

/**
 * @param info
 * @returns infoから参照できるInfoオブジェクトを列挙した配列
 */
function getReferenceable(info) {
	var ret = [];
	doForEachInfosDef(info, function(o) {
		ret.push(o);
	});
	return ret;
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
				fs.readFile(file, 'utf-8', function(err, text) {
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
			var text = FileUtils.readFileToString(new File(file), "utf-8");
			print('[読み込み完了] ' + file);
			srcMap[file] = '' + text;
		}
		next(srcMap);
	}
}

function createDependencyTree(srcMap) {
	var srcInfos = [];
	var namespaceInfos = [];
	var namespaceSrcInfoMap = {};
	var srcNamespaceMap = {};
	var namespaceNamespaceInfoMap = {};
	var missings = [];

	// 依存関係を求める
	// 最初に、全てのjsファイルを分析して、ツリーの作成に必要なリスト、マップを作成する
	for ( var src in srcMap) {
		var text = srcMap[src];
		print('[解析開始] ' + src);
		var infoObj = createDependsInfoObject(text);

		// ソースの依存関係
		var srcInfo = infoObj.srcInfo;
		var names = infoObj.names;
		srcInfo.src = src;
		srcNamespaceMap[src] = names;
		for (var i = 0, l = names.length; i < l; i++) {
			namespaceSrcInfoMap[names[i]] = srcInfo;
		}
		srcInfos.push(srcInfo);

		// 名前空間の依存関係
		Array.prototype.push.apply(namespaceInfos, infoObj.namespaceInfos);
		for (var i = 0, l = namespaceInfos.length; i < l; i++) {
			namespaceNamespaceInfoMap[namespaceInfos[i].name] = namespaceInfos[i];
		}
	}

	// -------------------------------------
	// ソースの依存関係ツリーを作成
	// -------------------------------------

	// srcInfo.dependsにある名前(文字列)をSrcInfoオブジェクトに変更
	// ない場合はmissingsに追加して、dependsから取り除く
	for (var i = 0, l = srcInfos.length; i < l; i++) {
		var srcInfo = srcInfos[i];
		var depends = srcInfo.depends;
		for (var j = 0, len = depends.length; j < len; j++) {
			var replaceInfo = namespaceSrcInfoMap[depends[j]];
			if (replaceInfo) {
				depends.splice(j, 1, replaceInfo);
			} else {
				missings.push(depends[j]);
				depends.splice(j, 1);
				j--;
				len--;
			}
		}
	}
	// ツリーの作成
	var srcDependencyTree = [];
	var referenceableSrcInfos = [];
	for (var i = 0, l = srcInfos.length; i < l; i++) {
		var srcInfo = srcInfos[i];
		if (referenceableSrcInfos.indexOf(srcInfo) !== -1) {
			// ツリーに追加済みノードから参照できるならツリーに追加しない
			continue;
		}
		// 参照可能ノードに追加
		var referenceable = getReferenceable(srcInfo);
		Array.prototype.push.apply(referenceableSrcInfos, referenceable);

		// 追加するノードがツリーのルートにあるノードを参照しているなら、それを消す
		for (var j = 0, len = srcDependencyTree.length; j < len; j++) {
			if (referenceable.indexOf(srcDependencyTree[j]) !== -1) {
				srcDependencyTree.splice(j, 1);
				len--;
				j--;
			}
		}
		// ツリーに追加
		srcDependencyTree.push(srcInfo);
	}

	// -------------------------------------
	// 名前空間の依存関係ツリーを作成
	// -------------------------------------
	var namespaceDependencyTree = [];
	var referenceableNamespaceInfos = [];
	// namespaceInfo.dependsにある名前(文字列)をnamespaceInfoオブジェクトに変更
	for (var i = 0, l = namespaceInfos.length; i < l; i++) {
		var info = namespaceInfos[i];
		var name = info.name;
		var depends = info.depends;
		for (var j = 0, len = depends.length; j < len; j++) {
			info.depends.splice(j, 1, namespaceNamespaceInfoMap[depends[j]]);
		}
	}

	for (var i = 0, l = namespaceInfos.length; i < l; i++) {
		var info = namespaceInfos[i];
		if (referenceableNamespaceInfos.indexOf(info) !== -1) {
			// ツリーに追加済みノードから参照できるならツリーに追加しない
			continue;
		}
		// 参照可能ノードに追加
		var referenceable = getReferenceable(info);
		Array.prototype.push.apply(referenceableNamespaceInfos, referenceable);

		// 追加するノードがツリーのルートにあるノードを参照しているなら、それを消す
		for (var j = 0, len = namespaceDependencyTree.length; j < len; j++) {
			if (referenceable.indexOf(namespaceDependencyTree[j]) !== -1) {
				namespaceDependencyTree.splice(j, 1);
				len--;
				j--;
			}
		}
		// ツリーに追加
		namespaceDependencyTree.push(info);
	}

	// ソースの読み込み順をソース依存関係ツリーから取得
	var srcList = [];
	var checkedDefs = [];
	for (var i = 0, l = srcDependencyTree.length; i < l; i++) {
		var info = srcDependencyTree[i];
		if (checkedDefs.indexOf(info) !== -1) {
			continue;
		}
		doForEachInfosDefDepthFirst(info, function(s) {
			if (checkedDefs.indexOf(s) !== -1) {
				return;
			}
			if (srcList.indexOf(s.src) === -1) {
				srcList.push(s.src);
				checkedDefs.push(s);
			}
		});
	}
	next({
		srcNamespaceMap : srcNamespaceMap,
		srcDependencyTree : srcDependencyTree,
		namespaceDependencyTree : namespaceDependencyTree,
		srcList : srcList,
		missings : missings
	});
}

/**
 * 結果をresponseに出力
 *
 * @param {Object}
 *            resultObj 以下のようなオブジェクト
 *
 * <pre>
 * {
 * 	srcNamespaceMap : srcNamespaceMap,
 * 	srcDependencyTree : srcDependencyTree,
 * 	namespaceDependencyTree : namespaceDependencyTree,
 * 	srcList : srcList
 * }
 * </pre>
 *
 */
function returnResult(resultObj) {
	print('解析が終了しました');
	var srcNamespaceMap = resultObj.srcNamespaceMap;
	var srcDependencyTree = resultObj.srcDependencyTree;
	var namespaceDependencyTree = resultObj.namespaceDependencyTree;
	var srcList = resultObj.srcList;
	var missings = resultObj.missings;

	if (isNodeJs) {
		res.writeHead(200, {
			'Content-Type' : 'application/json'
		});
		res.write('【依存関係に基づいたソースの読み込み順序】\n');
		res.write(JSON.stringify(srcList, null, "    "));
		res.write('\n\n');
		if (missings.length) {
			res.write('【定義箇所が見つからなかったリソースキー】\n');
			res.write(JSON.stringify(missings, null, "    "));
			res.write('\n\n');
		}
		res.write('【ソースと名前空間定義の対応】\n');
		res.write(JSON.stringify(srcNamespaceMap, null, "    "));
		res.write('\n\n');
		res.write('【ソースの依存関係】\n');
		res.write(JSON.stringify(srcDependencyTree, null, "    "));
		res.write('\n\n');
		res.write('【名前空間の依存関係】\n');
		res.write(JSON.stringify(namespaceDependencyTree, null, "    "));
		res.end();
	} else {
		// ${srcList}プロパティに代入
		project.setNewProperty('srcList', srcList);
	}
}

// -----------------------------------------------------
// 実行
// -----------------------------------------------------
/**
 * 初期化処理
 */
function init() {
	// シーケンス処理のindexを0
	callbacksIndex = 0;

	// requireFunctionsの解析("."区切りのものを配列にする)
	for (var i = 0, l = requireFunctions.length; i < l; i++) {
		var funcName = requireFunctions[i];
		if (funcName.indexOf('.') === -1) {
			continue;
		}
		requireFunctions[i] = funcName.split('.');
	}
}

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
	print('Server running at http://127.0.0.1:' + PORT + '/');
	http.createServer(main).listen(PORT);
} else {
	main();
}
