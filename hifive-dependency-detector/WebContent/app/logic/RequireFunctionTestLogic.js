h5.u.obj.expose('util',{
	req: h5.res.require
});

(function() {
	h5.core.expose({
		__name: 'app.logic.ReuireFunctionTestLogic',
		childLogic: util.req('app.logic.NoChildLogic'),
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready: function() {
			$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
		}
	});
})();