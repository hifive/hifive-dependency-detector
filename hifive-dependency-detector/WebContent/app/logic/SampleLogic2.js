(function() {
	h5.core.expose({
		__name : 'app.logic.SampleLogic2',
		__construct : function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready : function() {
			$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
		}
	});

	// どのjsでも定義していないリソースキー
	h5.res.require('hoge.hoge.hoge');
})();