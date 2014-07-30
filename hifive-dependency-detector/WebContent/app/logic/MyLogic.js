(function() {
	var logic = {
		__name: 'app.logic.MyLogic',
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready: function() {
			$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
		}
	};

	h5.core.expose(logic);
})();

(function() {
	var logic = {
		__name: 'app.logic.MyLogic2',
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready: function() {
			$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
		}
	};
	h5.core.expose(logic);

	h5.core.expose({
		__name: 'app.logic.MyLogic3',
		childLogic: h5.res.require('app.logic.MyLogic2'),
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready: function() {
			$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
		}
	});
})();