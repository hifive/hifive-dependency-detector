hifive-dependency-detector
----------------------------------------------
hifiveで記述された複数のソースファイル(jsファイル)について、依存関係を解析し、読み込むjsファイルの順番を計算するツールです。

src/dependencyDetector.js で定義されているdetectDependency()関数を実行すると依存関係の計算結果が返ってきます。

src/main.js が、detectDependency()に引数をセットして呼び出すためのメインjsファイルです。
設定ファイルは、node.js及びAntからの実行のどちらの場合もbuild.propertiesを読み込んでいます。

以下、サンプルの実行手順です。

1. Antから利用する方法
	<script>タグを使って、main.jsを実行します。
	build.xml を参考にしてください。

2. node.jsを利用する方法
	node.jsを使ってmain.jsを呼び出すと、ポート8081でサーバが立ち上がります。
	(ポート番号の変更はmain.jsのコメントに従って修正してください。)
	ブラウザでhttp://localhost:8081/ にアクセスすると、解析結果がブラウザに表示されます。


動作確認について
	build.xmlのbuildタスクを実行すると、WebContent/app内のjsファイルの依存関係を解析してソースファイルをマージしたjsファイルを出力します。
	WebContent/index.html は、マージしたjsファイルを読み込んでいて、正しくマージされるとコントローラ、ロジックのバインドが行われます。
