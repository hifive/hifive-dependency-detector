(function() {
	h5.core.expose({
		__name: 'app.logic.SampleLogic',
		childLogic: h5.res.require('app.logic.SampleLogic2'),
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready: function() {
			$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
		}
	});
})();