// node.jsが起ち上げるサーバのポート番号
var PORT = 8081;

var globalObject = this;

/**
 * グローバルの共通オブジェクト
 */
common = {};
functions = {};

/** 文字列出力関数 */
print = this.print || console.log;

/**
 * node.jsからの実行かどうか
 */
common.isNodeJs = !!global.GLOBAL;

/**
 * 外部jsファイル読み込み関数をグローバルで定義
 * <p>
 * ファイルパスはmain.jsからの相対パスで指定
 * <p>
 *
 * @param path
 */
common.require = common.isNodeJs ? function(path) {
	return require('./' + path);
} : function(path) {
	path = project.getProperty('main.js.dir') + '/' + path;
	print(path);
	eval
			.call(globalObject, ''
					+ new java.lang.String(java.nio.file.Files.readAllBytes(java.nio.file.Paths
							.get(path))));
};

(function() {
	var isNodeJs = common.isNodeJs;

	// ------------------------------------------
	// プロパティファイルからプロパティ読み込み
	// ------------------------------------------

	/** カレントディレクトリ(nodeの場合はこのjsファイルがある場所が起点、Antの場合はプロパティから読み込む */
	var currentDir = isNodeJs ? '.' : project.getProperty('build.js.dir');

	/** デフォルトのrequireFunctions */
	var defaultRequireFunctions = ['h5.res.require'];

	// プロパティファイルから読み込む引数設定
	var PROPERTY_KEY_SRC_DIR = isNodeJs ? 'src.dir.from.main.js' : 'src.dir';
	var PROPERTY_KEY_REQUIRE_FUNCTIONS = 'requireFunctions';
	var PROPERTY_KEY_SRC_ENCODING = 'src.encoding';
	var srcDir = null;
	var requireFunctions = null;
	var encoding = null;

	if (isNodeJs) {
		// プロパティファイルから読み込む
		var propertiesFilePath = '../build.properties';
		var fs = require('fs');
		var desc = fs.readFileSync(propertiesFilePath, 'utf-8');
		var lines = desc.split('\n');
		for (var i = 0, l = lines.length; i < l; i++) {
			var line = lines[i];
			line = line.trim();
			if (!line || line.indexOf('#') === 1 || line.indexOf('!') === 1) {
				// 空行またはコメント行は無視
				continue;
			}
			var equalIndex = line.indexOf('=');
			var p = line.slice(0, equalIndex);
			var v = line.slice(equalIndex + 1);
			switch (p) {
			case PROPERTY_KEY_SRC_DIR:
				srcDir = v;
				break;
			case PROPERTY_KEY_REQUIRE_FUNCTIONS:
				requireFunctions = v.split(',');
				break;
			case PROPERTY_KEY_SRC_ENCODING:
				encoding = v;
				break;
			}
		}

		// カレントディレクトリはこのjsファイルの場所
		currentDir = '.';
	} else {
		// プロパティから読み込む
		// src.dirを取得
		srcDir = project.getProperty(PROPERTY_KEY_SRC_DIR);
		// require.functionsを取得
		requireFunctions = project.getProperty(PROPERTY_KEY_REQUIRE_FUNCTIONS)
				|| defaultRequireFunctions;
		// ソースファイルのエンコードを取得
		encoding = project.getProperty(PROPERTY_KEY_SRC_ENCODING);

		// カレントディレクトリはbuild.js.dirから取得
		currentDir = project.getProperty('build.js.dir');
	}

	// ------------------------------
	// メイン関数
	// ------------------------------
	// 依存関係計算jsファイルの読み込み
	common.require('dependencyDetector.js');

	function main(req, res) {
		print('main start');
		if (isNodeJs) {
			if (req.url === '/favicon.ico') {
				return;
			}
		}
		// ソースリストの計算
		var result = functions.detectDependency(srcDir, encoding, requireFunctions);
		print('解析が終了しました');

		var srcNamespaceMap = result.srcNamespaceMap;
		var srcDependencyTree = result.srcDependencyTree;
		var namespaceDependencyTree = result.namespaceDependencyTree;
		var srcList = result.srcList;
		var missings = result.missings;

		if (isNodeJs) {
			// nodeならブラウザに結果を表示
			res.writeHead(200, {
				'Content-Type': 'text/plain'
			});
			res.write('【依存関係に基づいたソースの読み込み順序】\n');
			res.write(JSON.stringify(srcList, null, '    '));
			res.write('\n\n');
			if (missings.length) {
				res.write('【定義箇所が見つからなかったリソースキー】\n');
				res.write(JSON.stringify(missings, null, '    '));
				res.write('\n\n');
			}
			res.write('【ソースと名前空間定義の対応】\n');
			res.write(JSON.stringify(srcNamespaceMap, null, '    '));
			res.write('\n\n');
			res.write('【ソースの依存関係】\n');
			res.write(JSON.stringify(srcDependencyTree, null, '    '));
			res.write('\n\n');
			res.write('【名前空間の依存関係】\n');
			res.write(JSON.stringify(namespaceDependencyTree, null, '    '));
			res.end();
		} else {
			// srcList以外は返さない
			// ${srcList}プロパティに代入
			project.setNewProperty('srcList', srcList);
		}
		return result;
	}

	// nodeならサーバを立ち上げてlistenする
	// Antからならmain()を即実行
	if (isNodeJs) {
		print('Server running at http://127.0.0.1:' + PORT + '/');
		http.createServer(main).listen(PORT);
	} else {
		return main();
	}
})();
