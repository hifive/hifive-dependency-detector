(function() {
	var logic = {
		__name: 'app.logic.Grand2Logic',
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready: function() {
			var d = $.Deferred();
			setTimeout(this.own(function() {
				$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
				d.resolve();
			}), 1000);
			return d.promise();
		}
	};

	h5.core.expose(logic);
})();
(function() {
	var logic = {
		__name: 'app.logic.GrandLogic',
		my2Logic: h5.res.require('app.logic.Grand2Logic'),
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
	var controller = {
		__name: 'app.controller.GrandChildController',
		my1Logic: h5.res.require('app.logic.GrandLogic'),
		__construct:function(){
			$('body').append('<p>' + this.__name + 'の初期化処理を開始します(__construct実行)</p>');
		},
		__ready:function(){
			$(this.rootElement).append('<p>' + this.__name + 'のバインドが完了しました(__ready実行)</p>');
		},
		__init: function() {
			$('body').append('<p>' + this.__name + 'の__initが実行されました</p>');
		},
		__dispose:function(){
			$('body').append('<p>' + this.__name + 'をdisposeしました</p>');
		}
	};
	h5.core.expose(controller);
})();
(function() {
	var logic = {
		__name: 'app.logic.ChildLogic',
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready: function() {
			var d = $.Deferred();
			setTimeout(this.own(function() {
				$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
				d.resolve();
			}), 500);
			return d.promise();
		}
	};
	h5.core.expose(logic);
})();
(function() {
	var controller = {
		__name: 'app.controller.ChildController',
		childController: h5.res.require('app.controller.GrandChildController'),
		myLogic: h5.res.require('app.logic.ChildLogic'),
		__templates: h5.res.require('template/sample1.ejs'),
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化処理を開始します(__construct実行)</p>');
		},
		__init: function() {
			$('body').append('<p>' + this.__name + 'の__initが実行されました</p>');
			this.view.append(this.rootElement, 'sample1');
		},
		__ready: function() {
			$(this.rootElement).append('<p>' + this.__name + 'のバインドが完了しました(__ready実行)</p>');
		},
		__dispose: function() {
			$('body').append('<p>' + this.__name + 'をdisposeしました</p>');
		}
	};
	h5.core.expose(controller);
})();
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
(function() {
	var controller = {
		__name: 'app.controller.PageController',
		childController: h5.res.require('app.controller.ChildController'),
		myLogic: h5.res.require('app.logic.MyLogic'),
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化処理を開始します(__construct実行)</p>');
		},
		__ready: function() {
			$(this.rootElement).append('<p>' + this.__name + 'のバインドが完了しました(__ready実行)</p>');
		},
		__init: function() {
			$('body').append('<p>' + this.__name + 'の__initが実行されました</p>');
		},
		__dispose:function(){
			$('body').append('<p>' + this.__name + 'をdisposeしました</p>');
		}
	};
	h5.core.expose(controller);
})();
(function() {
	var controller = {
		__name: 'app.controller.PageController2',
		childController: h5.res.require('app.controller.ChildController'),
		myLogic: h5.res.require('app.logic.MyLogic'),
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化処理を開始します(__construct実行)</p>');
		},
		__ready: function() {
			$(this.rootElement).append('<p>' + this.__name + 'のバインドが完了しました(__ready実行)</p>');
		},
		__init: function() {
			$('body').append('<p>' + this.__name + 'の__initが実行されました</p>');
		},
		__dispose: function() {
			$('body').append('<p>' + this.__name + 'をdisposeしました</p>');
		}
	};
	h5.core.expose(controller);
})();
(function() {
	h5.core.expose({
		__name: 'app.logic.SampleLogic2',
		__construct: function() {
			$('body').append('<p>' + this.__name + 'の初期化を開始します</p>');
		},
		__ready: function() {
			$('body').append('<p>' + this.__name + 'の__readyが実行されました</p>');
		}
	});
})();
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
