// -------------------------------------
// プロジェクト設定
// -------------------------------------
var PATH_ESPRIMA_ANT = 'res/lib/esprima/esprima.js';
var PATH_ESTRAVERSE_ANT = 'res/lib/estraverse/estraverse.js';

/** js解析オブジェクト */
var esprima, estraverse;
esprima = common.require(PATH_ESPRIMA_ANT) || esprima; // esprima
estraverse = common.require(PATH_ESTRAVERSE_ANT) || estraverse; // estraverse

// -------------------------------------
// Functions
// -------------------------------------
// 別ファイルの関数定義をロード
common.require(common.isNodeJs ? 'functions_node.js' : 'functions_ant.js');

/**
 * 指定されたノードがh5.res.requireの呼び出し、またはh5.res.requireが格納されている変数の呼び出しかどうか
 *
 * @param {Node} node estraverseで解析したノード
 * @param {Array} requireFunctions
 * @returns {Boolean}
 */
function isRequireCalleeNode(node, requireFunctions) {
	// estraversのSyntaxオブジェクト
	var Syntax = estraverse.Syntax;

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
 * @param {Node} arg argumentsノード
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
 * @param {Array} requireFunctions
 * @returns {Object} {src:'hoge.js', names:[], depends:[]}
 */
function createSrcInfo(text, requireFunctions) {
	// estraversのSyntaxオブジェクト
	var Syntax = estraverse.Syntax;
	// SyntaxTreeをみてexposeされている__nameを取得するようにする
	var names = [];
	var depends = [];
	var srcInfo = {
		names: names,
		depends: depends
	};
	var ast = esprima.parse(text);
	estraverse.traverse(ast, {
		leave: function(node, parent) {
			if (node.type === Syntax.Property && node.key && node.key.name === '__name') {
				var name = node.value.value;
				names.push(name);
				return;
			}
			if (isRequireCalleeNode(node, requireFunctions)) {
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
 * @param {Array} requireFunctions
 * @returns {Object}
 */
function createDependsInfoObject(text, requireFunctions) {
	// estraversのSyntaxオブジェクト
	var Syntax = estraverse.Syntax;

	var names = [];
	var depends = [];
	var srcInfo = {
		depends: depends
	};

	var nameToDefObj = {};
	var tmpDepends = [];
	var tmpDef = null;
	var namespaceDepensMap = {};

	var ast = esprima.parse(text);
	estraverse.traverse(ast,
			{
				leave: function(node, parent) {
					if (node.type === Syntax.Property && node.key && node.key.name === '__name') {
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
					if (isRequireCalleeNode(node, requireFunctions)) {
						var val = node.arguments[0].value;

						// ejsは除く
						if (val.lastIndexOf('.ejs') === val.length - 4) {
							return;
						}
						depends.push(val);
					}

					// オブジェクト定義の値にrequire呼び出しがある場合はそのオブジェクトが定義されている名前空間と紐づける
					if (node.type === Syntax.Property
							&& isRequireCalleeNode(node.value, requireFunctions)) {
						var val = node.value.arguments[0].value;

						var def = parent;
						for ( var name in nameToDefObj) {
							if (nameToDefObj[name] === def) {
								namespaceDepensMap[name] = namespaceDepensMap[name] || [];
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
			name: name,
			depends: namespaceDepensMap[name]
		});
	}
	return {
		srcInfo: srcInfo,
		names: names,
		namespaceInfos: namespaceInfos
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

/**
 * 依存関係を計算します
 * <p>
 * 以下のようなオブジェクトを返します
 * </p>
 *
 * <pre><code>
 * {
 * 	srcNamespaceMap: ソースファイルとそのソースファイルで定義された名前空間のマップ,
 * 	srcDependencyTree: ソース間の依存関係ツリー,
 * 	namespaceDependencyTree: 名前空間間の依存関係ツリー,
 * 	missings: ソースファイル上で定義されていない名前空間のリスト,
 * 	srcList: 依存関係に基づいた順序で並んだソースファイルリスト
 * }
 * </code></pre>
 *
 * @param {Object} srcMap キーにソースファイルパス、値にその中身を持つオブジェクト
 * @param {Array} requireFunctions
 * @returns {Object}
 */
function createDependencyTree(srcMap, requireFunctions) {
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
		var infoObj = createDependsInfoObject(text, requireFunctions);

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
	return {
		srcNamespaceMap: srcNamespaceMap,
		srcDependencyTree: srcDependencyTree,
		namespaceDependencyTree: namespaceDependencyTree,
		srcList: srcList,
		missings: missings
	};
}

/**
 * requireFunctionsのオブジェクト区切りを配列に変換する
 *
 * @param {String[]} requireFunctions
 */
function compileRequireFunctions(requireFunctions) {
	// requireFunctionsの解析("."区切りのものを配列にする)
	for (var i = 0, l = requireFunctions.length; i < l; i++) {
		var funcName = requireFunctions[i];
		if (funcName.indexOf('.') === -1) {
			continue;
		}
		requireFunctions[i] = funcName.split('.');
	}
}

// -------------------------------------------------------
// Body
// -------------------------------------------------------
/**
 * srcDir内のjsファイルの依存関係を計算します
 *
 * @param srcDir
 * @oaram encoding
 * @param {Array} requireFunctions
 */
function detectDependency(srcDir, encoding, requireFunctions) {
	// 関数定義を読み込む
	if (common.isNodeJs) {
		common.require('functions_node.js');
	} else {
		common.require('functions_ant.js');
	}

	// 初期化処理
	compileRequireFunctions(requireFunctions);

	// ファイルのリストを取得
	var fileList = functions.enumerateFiles(srcDir);
	print('以下のファイルについて、依存関係を計算します');
	print(fileList);

	// ファイルの読み込み
	var srcMap = functions.readFiles(fileList, encoding);

	// 依存関係計算
	var result = createDependencyTree(srcMap, requireFunctions);

	// 結果を返す
	return result;
}

//------------------------
// export
//------------------------
functions.detectDependency = detectDependency;
