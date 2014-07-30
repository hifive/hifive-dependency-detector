(function() {
	/* コントローラのプロパティとは関係ないところでrequireしている例 */
	var dependency = h5.res.require('app.logic.SampleLogic2');

	h5.core.expose({
		__name : 'app.logic.SampleLogic',
		childLogic : dependency,
		__construct : function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready : function() {
			$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
		}
	});
})();