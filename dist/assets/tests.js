'use strict';

define("animations/tests/helpers/ember-power-select", ["exports", "ember-power-select/test-support/helpers"], function (_exports, _helpers) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = deprecatedRegisterHelpers;
  _exports.selectChoose = _exports.touchTrigger = _exports.nativeTouch = _exports.clickTrigger = _exports.typeInSearch = _exports.triggerKeydown = _exports.nativeMouseUp = _exports.nativeMouseDown = _exports.findContains = void 0;

  function deprecateHelper(fn, name) {
    return function (...args) {
      (true && !(false) && Ember.deprecate(`DEPRECATED \`import { ${name} } from '../../tests/helpers/ember-power-select';\` is deprecated. Please, replace it with \`import { ${name} } from 'ember-power-select/test-support/helpers';\``, false, {
        until: '1.11.0',
        id: `ember-power-select-test-support-${name}`
      }));
      return fn(...args);
    };
  }

  let findContains = deprecateHelper(_helpers.findContains, 'findContains');
  _exports.findContains = findContains;
  let nativeMouseDown = deprecateHelper(_helpers.nativeMouseDown, 'nativeMouseDown');
  _exports.nativeMouseDown = nativeMouseDown;
  let nativeMouseUp = deprecateHelper(_helpers.nativeMouseUp, 'nativeMouseUp');
  _exports.nativeMouseUp = nativeMouseUp;
  let triggerKeydown = deprecateHelper(_helpers.triggerKeydown, 'triggerKeydown');
  _exports.triggerKeydown = triggerKeydown;
  let typeInSearch = deprecateHelper(_helpers.typeInSearch, 'typeInSearch');
  _exports.typeInSearch = typeInSearch;
  let clickTrigger = deprecateHelper(_helpers.clickTrigger, 'clickTrigger');
  _exports.clickTrigger = clickTrigger;
  let nativeTouch = deprecateHelper(_helpers.nativeTouch, 'nativeTouch');
  _exports.nativeTouch = nativeTouch;
  let touchTrigger = deprecateHelper(_helpers.touchTrigger, 'touchTrigger');
  _exports.touchTrigger = touchTrigger;
  let selectChoose = deprecateHelper(_helpers.selectChoose, 'selectChoose');
  _exports.selectChoose = selectChoose;

  function deprecatedRegisterHelpers() {
    (true && !(false) && Ember.deprecate("DEPRECATED `import registerPowerSelectHelpers from '../../tests/helpers/ember-power-select';` is deprecated. Please, replace it with `import registerPowerSelectHelpers from 'ember-power-select/test-support/helpers';`", false, {
      until: '1.11.0',
      id: 'ember-power-select-test-support-register-helpers'
    }));
    return (0, _helpers.default)();
  }
});
define("animations/tests/page-object", ["exports", "ember-cli-page-object/test-support/-private/deprecate", "ember-cli-page-object"], function (_exports, _deprecate, _emberCliPageObject) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  Object.defineProperty(_exports, "alias", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.alias;
    }
  });
  Object.defineProperty(_exports, "attribute", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.attribute;
    }
  });
  Object.defineProperty(_exports, "clickOnText", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.clickOnText;
    }
  });
  Object.defineProperty(_exports, "clickable", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.clickable;
    }
  });
  Object.defineProperty(_exports, "collection", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.collection;
    }
  });
  Object.defineProperty(_exports, "contains", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.contains;
    }
  });
  Object.defineProperty(_exports, "count", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.count;
    }
  });
  Object.defineProperty(_exports, "create", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.create;
    }
  });
  Object.defineProperty(_exports, "fillable", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.fillable;
    }
  });
  Object.defineProperty(_exports, "selectable", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.fillable;
    }
  });
  Object.defineProperty(_exports, "focusable", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.focusable;
    }
  });
  Object.defineProperty(_exports, "hasClass", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.hasClass;
    }
  });
  Object.defineProperty(_exports, "is", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.is;
    }
  });
  Object.defineProperty(_exports, "isHidden", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.isHidden;
    }
  });
  Object.defineProperty(_exports, "isPresent", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.isPresent;
    }
  });
  Object.defineProperty(_exports, "isVisible", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.isVisible;
    }
  });
  Object.defineProperty(_exports, "notHasClass", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.notHasClass;
    }
  });
  Object.defineProperty(_exports, "property", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.property;
    }
  });
  Object.defineProperty(_exports, "text", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.text;
    }
  });
  Object.defineProperty(_exports, "triggerable", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.triggerable;
    }
  });
  Object.defineProperty(_exports, "value", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.value;
    }
  });
  Object.defineProperty(_exports, "visitable", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.visitable;
    }
  });
  Object.defineProperty(_exports, "buildSelector", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.buildSelector;
    }
  });
  Object.defineProperty(_exports, "findElementWithAssert", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.findElementWithAssert;
    }
  });
  Object.defineProperty(_exports, "findElement", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.findElement;
    }
  });
  Object.defineProperty(_exports, "getContext", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.getContext;
    }
  });
  Object.defineProperty(_exports, "fullScope", {
    enumerable: true,
    get: function () {
      return _emberCliPageObject.fullScope;
    }
  });
  _exports.default = void 0;
  var _default = {
    alias: _emberCliPageObject.alias,
    attribute: _emberCliPageObject.attribute,
    blurrable: _emberCliPageObject.blurrable,
    clickOnText: _emberCliPageObject.clickOnText,
    clickable: _emberCliPageObject.clickable,
    collection: _emberCliPageObject.collection,
    contains: _emberCliPageObject.contains,
    count: _emberCliPageObject.count,
    create: _emberCliPageObject.create,
    fillable: _emberCliPageObject.fillable,
    focusable: _emberCliPageObject.focusable,
    hasClass: _emberCliPageObject.hasClass,
    is: _emberCliPageObject.is,
    isHidden: _emberCliPageObject.isHidden,
    isPresent: _emberCliPageObject.isPresent,
    isVisible: _emberCliPageObject.isVisible,
    notHasClass: _emberCliPageObject.notHasClass,
    property: _emberCliPageObject.property,
    selectable: _emberCliPageObject.fillable,
    text: _emberCliPageObject.text,
    triggerable: _emberCliPageObject.triggerable,
    value: _emberCliPageObject.value,
    visitable: _emberCliPageObject.visitable
  };
  _exports.default = _default;
  (0, _deprecate.default)('import-from-test-support', `Importing from "test-support" is now deprecated. Please import directly from the "ember-cli-page-object" module instead.`, '1.16.0', '2.0.0');
});
define("animations/tests/test-helper", ["animations/app", "animations/config/environment", "qunit", "@ember/test-helpers", "qunit-dom", "ember-qunit"], function (_app, _environment, QUnit, _testHelpers, _qunitDom, _emberQunit) {
  "use strict";

  (0, _testHelpers.setApplication)(_app.default.create(_environment.default.APP));
  (0, _qunitDom.setup)(QUnit.assert);
  (0, _emberQunit.start)();
});
define("animations/tests/unit/behaviors/linear-test", ["qunit", "animations/behaviors/linear"], function (_qunit, _linear) {
  "use strict";

  (0, _qunit.module)('Unit | Behaviors | Linear', function () {
    (0, _qunit.test)('generates minimum of 2 frames', function (assert) {
      let behavior = new _linear.default();
      assert.deepEqual(behavior.toFrames({
        from: 0,
        to: 1,
        duration: 0
      }), [{
        value: 0,
        velocity: 0.000059999999999999995
      }, {
        value: 1,
        velocity: 0.000059999999999999995
      }]);
      assert.deepEqual(behavior.toFrames({
        from: 1,
        to: 0,
        duration: 0
      }), [{
        value: 1,
        velocity: -0.000059999999999999995
      }, {
        value: 0,
        velocity: -0.000059999999999999995
      }]);
    });
    (0, _qunit.test)('does nothing when from and to are the same', function (assert) {
      let behavior = new _linear.default();
      assert.deepEqual(behavior.toFrames({
        from: 1,
        to: 1,
        duration: 0
      }), []);
      assert.deepEqual(behavior.toFrames({
        from: 0,
        to: 0,
        duration: 0
      }), []);
    });
    (0, _qunit.test)('frames are generated at 60 FPS', function (assert) {
      let behavior = new _linear.default();
      let frames = behavior.toFrames({
        from: 0,
        to: 1,
        duration: 100
      });
      assert.equal(frames.length, 7);
      assert.deepEqual(frames, [{
        value: 0,
        velocity: 0.00001
      }, {
        value: 0.16666666666666666,
        velocity: 0.00001
      }, {
        value: 0.3333333333333333,
        velocity: 0.00001
      }, {
        value: 0.5,
        velocity: 0.00001
      }, {
        value: 0.6666666666666666,
        velocity: 0.00001
      }, {
        value: 0.8333333333333334,
        velocity: 0.00001
      }, {
        value: 1,
        velocity: 0.00001
      }]);
    });
    (0, _qunit.test)('takes a delay into account', function (assert) {
      let behavior = new _linear.default();
      let frames = behavior.toFrames({
        from: 0,
        to: 1,
        duration: 100,
        delay: 50
      });
      assert.equal(frames.length, 10);
      assert.deepEqual(frames, [{
        value: 0,
        velocity: 0
      }, {
        value: 0,
        velocity: 0
      }, {
        value: 0,
        velocity: 0
      }, {
        value: 0,
        velocity: 0.00001
      }, {
        value: 0.16666666666666666,
        velocity: 0.00001
      }, {
        value: 0.3333333333333333,
        velocity: 0.00001
      }, {
        value: 0.5,
        velocity: 0.00001
      }, {
        value: 0.6666666666666666,
        velocity: 0.00001
      }, {
        value: 0.8333333333333334,
        velocity: 0.00001
      }, {
        value: 1,
        velocity: 0.00001
      }]);
    });
    (0, _qunit.test)('takes previous frames into account', function (assert) {
      let behavior = new _linear.default();
      let previousFramesFromTime = [{
        value: 0.25,
        velocity: 0.000015
      }, {
        value: 0.5,
        velocity: 0.000015
      }, {
        value: 0.75,
        velocity: 0.000015
      }, {
        value: 1,
        velocity: 0.000015
      }];
      let frames = behavior.toFrames({
        from: 1,
        to: 0,
        duration: 100,
        previousFramesFromTime
      });
      assert.equal(frames.length, 7);
      assert.deepEqual(frames, [{
        value: 0.25,
        velocity: 0 // TODO: fix this, there should be a velocity here from the frame before

      }, {
        value: 0.6111111111111112,
        velocity: 0.00001333333333333333
      }, {
        value: 0.6944444444444444,
        velocity: -0.000003333333333333335
      }, {
        value: 0.5,
        velocity: -0.00001083333333333333
      }, {
        value: 0.33333333333333337,
        velocity: -0.00001
      }, {
        value: 0.16666666666666663,
        velocity: -0.00001
      }, {
        value: 0,
        velocity: -0.00001
      }]);
    });
    (0, _qunit.test)('takes previous frames and delay into account', function (assert) {
      let behavior = new _linear.default();
      let previousFramesFromTime = [{
        value: 0.25,
        velocity: 0.000015
      }, {
        value: 0.5,
        velocity: 0.000015
      }, {
        value: 0.75,
        velocity: 0.000015
      }, {
        value: 1,
        velocity: 0.000015
      }];
      let frames = behavior.toFrames({
        from: 1,
        to: 0,
        duration: 100,
        delay: 50,
        previousFramesFromTime
      });
      assert.equal(frames.length, 10);
      assert.deepEqual(frames, [{
        value: 0.25,
        velocity: 0
      }, {
        value: 0.6666666666666667,
        velocity: 0.000019999999999999998
      }, {
        value: 0.9166666666666666,
        velocity: 0.000009999999999999997
      }, {
        value: 1,
        velocity: -0.0000024999999999999977
      }, {
        value: 0.8333333333333334,
        velocity: -0.00001
      }, {
        value: 0.6666666666666667,
        velocity: -0.00001
      }, {
        value: 0.5,
        velocity: -0.00001
      }, {
        value: 0.33333333333333337,
        velocity: -0.00001
      }, {
        value: 0.16666666666666663,
        velocity: -0.00001
      }, {
        value: 0,
        velocity: -0.00001
      }]);
    });
    (0, _qunit.test)('takes last frame and previous frames into account', function (assert) {
      let behavior = new _linear.default();
      let lastFrame = {
        value: 0,
        velocity: 0.000015
      };
      let previousFramesFromTime = [{
        value: 0.25,
        velocity: 0.000015
      }, {
        value: 0.5,
        velocity: 0.000015
      }, {
        value: 0.75,
        velocity: 0.000015
      }, {
        value: 1,
        velocity: 0.000015
      }];
      let frames = behavior.toFrames({
        from: 1,
        to: 0,
        duration: 100,
        lastFrame,
        previousFramesFromTime
      });
      assert.equal(frames.length, 7);
      assert.deepEqual(frames, [{
        value: 0.25,
        velocity: 0.000018333333333333333
      }, {
        value: 0.6111111111111112,
        velocity: 0.00001333333333333333
      }, {
        value: 0.6944444444444444,
        velocity: -0.000003333333333333335
      }, {
        value: 0.5,
        velocity: -0.00001083333333333333
      }, {
        value: 0.33333333333333337,
        velocity: -0.00001
      }, {
        value: 0.16666666666666663,
        velocity: -0.00001
      }, {
        value: 0,
        velocity: -0.00001
      }]);
    });
  });
});
define("animations/tests/unit/behaviors/spring-test", ["qunit", "animations/behaviors/spring"], function (_qunit, _spring) {
  "use strict";

  (0, _qunit.module)('Unit | Behaviors | Spring', function () {
    (0, _qunit.test)('generates minimum of 2 frames', function (assert) {
      let spring = new _spring.default({
        overshootClamping: true,
        stiffness: 1000000
      });
      assert.deepEqual(spring.toFrames({
        from: 0,
        to: 1
      }), [{
        value: 0,
        velocity: 0
      }, {
        value: 1,
        velocity: 0
      }]);
      assert.deepEqual(spring.toFrames({
        from: 1,
        to: 0
      }), [{
        value: 1,
        velocity: 0
      }, {
        value: 0,
        velocity: 0
      }]);
    });
    (0, _qunit.test)('does nothing when from and to are the same', function (assert) {
      let behavior = new _spring.default();
      assert.deepEqual(behavior.toFrames({
        from: 1,
        to: 1
      }), []);
      assert.deepEqual(behavior.toFrames({
        from: 0,
        to: 0
      }), []);
    });
    (0, _qunit.test)('handles from and to being the same with an initial velocity', function (assert) {
      let behavior = new _spring.default();
      assert.deepEqual(behavior.toFrames({
        from: 0,
        to: 0,
        velocity: -0.01
      }), [{
        value: 0,
        velocity: 0.01
      }, {
        value: 0.1528088570040308,
        velocity: 0.008340728171260428
      }, {
        value: 0.27825797446520345,
        velocity: 0.006723269174896948
      }, {
        value: 0.3773452034749068,
        velocity: 0.005182493230700138
      }, {
        value: 0.4515881528317107,
        velocity: 0.00374595983627717
      }, {
        value: 0.5029056563803183,
        velocity: 0.0024343365787769557
      }, {
        value: 0.5335071951146929,
        velocity: 0.0012619295827700854
      }, {
        value: 0.545791875591495,
        velocity: 0.0002372949152267094
      }, {
        value: 0.5422580763871937,
        velocity: -0.0006360970882793976
      }, {
        value: 0.5254244313351902,
        velocity: -0.001359169658926184
      }, {
        value: 0.49776242621940764,
        velocity: -0.0019365415343160382
      }, {
        value: 0.4616405466664897,
        velocity: -0.0023758417271099747
      }, {
        value: 0.4192796296663318,
        velocity: -0.0026870526452044416
      }, {
        value: 0.372718838511412,
        velocity: -0.002881893979295509
      }, {
        value: 0.32379149883166436,
        velocity: -0.0029732568269375745
      }, {
        value: 0.27410989870570257,
        velocity: -0.002974694786123948
      }, {
        value: 0.22505806470996348,
        velocity: -0.002899976263499643
      }, {
        value: 0.17779147386102315,
        velocity: -0.00276270002797449
      }, {
        value: 0.13324264401804112,
        velocity: -0.0025759741142645292
      }, {
        value: 0.09213155758676851,
        velocity: -0.002352156547694297
      }, {
        value: 0.0549799104366701,
        velocity: -0.0021026550181452
      }, {
        value: 0.022128235055606713,
        velocity: -0.0018377815671486932
      }, {
        value: -0.006244980412685898,
        velocity: -0.0015666575520376618
      }, {
        value: -0.030102971708941856,
        velocity: -0.0012971635947110908
      }, {
        value: -0.049529879741914945,
        velocity: -0.0010359288867213428
      }, {
        value: -0.0647100415508969,
        velocity: -0.0007883540817808243
      }, {
        value: -0.07590790275391474,
        velocity: -0.0005586620350229877
      }, {
        value: -0.08344896885182705,
        velocity: -0.00034997081879900273
      }, {
        value: -0.0877021221654635,
        velocity: -0.00016438373126346492
      }, {
        value: -0.08906354615585563,
        velocity: -0.0000030913913752849244
      }, {
        value: -0.08794242073251282,
        velocity: 0.00013351854137479743
      }, {
        value: -0.08474848182992072,
        velocity: 0.0002457479938860654
      }, {
        value: -0.07988147662261798,
        velocity: 0.00033447490797619474
      }, {
        value: -0.07372249254287452,
        velocity: 0.00040104240013864303
      }, {
        value: -0.06662709378421994,
        velocity: 0.000447153062680276
      }, {
        value: -0.05892016301478995,
        velocity: 0.0004747703151429457
      }, {
        value: -0.05089231819640906,
        velocity: 0.0004860282418869083
      }, {
        value: -0.04279775417059092,
        velocity: 0.0004831509146522183
      }, {
        value: -0.03485334538203434,
        velocity: 0.0004683818034524748
      }, {
        value: -0.027238839036949826,
        velocity: 0.0004439235290021361
      }, {
        value: -0.020097966363743433,
        velocity: 0.000411887907016877
      }, {
        value: -0.013540302663157908,
        velocity: 0.00037425597962720725
      }, {
        value: -0.0076437137130694315,
        velocity: 0.0003328475209883895
      }, {
        value: -0.0024572360618388923,
        velocity: 0.0002892993410618076
      }, {
        value: 0.0019957489255270577,
        velocity: 0.0002450515907321167
      }, {
        value: 0.005714173389446872,
        velocity: 0.00020134118950138657
      }, {
        value: 0.008715884704400708,
        velocity: 0.0001592014500872878
      }, {
        value: 0.011034286050725949,
        velocity: 0.00011946695817027135
      }, {
        value: 0.012715095623345283,
        velocity: 0.00008278277596188797
      }, {
        value: 0.013813288992926649,
        velocity: 0.00004961707086704248
      }, {
        value: 0.014390274555290041,
        velocity: 0.00002027632105086197
      }, {
        value: 0.014511338388718938,
        velocity: -0.000005077685847836063
      }, {
        value: 0.01424338238586361,
        velocity: -0.000026409770067374123
      }, {
        value: 0.013652968376462413,
        velocity: -0.00004379282114229743
      }, {
        value: 0.012804671193834542,
        velocity: -0.00005738934662324687
      }, {
        value: 0.011759735298285915,
        velocity: -0.00006743356570549744
      }, {
        value: 0.010575022648582592,
        velocity: -0.00007421442121284853
      }, {
        value: 0.009302233967521532,
        velocity: -0.00007805980260959573
      }, {
        value: 0.007987381309544024,
        velocity: -0.00007932219686849877
      }, {
        value: 0.006670486814825672,
        velocity: -0.00007836591428640314
      }, {
        value: 0.005385480616059636,
        velocity: -0.00007555597355385795
      }, {
        value: 0.004160269930512819,
        velocity: -0.00007124867508634149
      }, {
        value: 0.0030169512935579496,
        velocity: -0.00006578384407486196
      }, {
        value: 0.00197213854111426,
        velocity: -0.00005947868493695467
      }, {
        value: 0.0010373803989393855,
        velocity: -0.000052623156667530715
      }, {
        value: 0,
        velocity: 0
      }]);
    });
    (0, _qunit.test)('overshootClamping prevents the spring from exceeding its target value', function (assert) {
      let unclampedSpring = new _spring.default({
        overshootClamping: false,
        damping: 100,
        stiffness: 100000
      });
      assert.deepEqual(unclampedSpring.toFrames({
        from: 0,
        to: 1
      }), [{
        value: 0,
        velocity: 0
      }, {
        value: 0.8561306451232562,
        velocity: -0.12268904506936934
      }, {
        value: 1.129827626527687,
        velocity: -0.05035498930918157
      }, {
        value: 1.0804582724019351,
        velocity: 0.0025058821427456123
      }, {
        value: 1.0085010368734653,
        velocity: 0.010539312543348403
      }, {
        value: 0.9882924567744584,
        velocity: 0.003852326384191916
      }, {
        value: 0.9935892608552294,
        velocity: -0.00040951734140965866
      }, {
        value: 1,
        velocity: 0
      }]);
      let clampedSpring = new _spring.default({
        overshootClamping: true,
        damping: 100,
        stiffness: 100000
      });
      assert.deepEqual(clampedSpring.toFrames({
        from: 0,
        to: 1
      }), [{
        value: 0,
        velocity: 0
      }, {
        value: 0.8561306451232562,
        velocity: -0.12268904506936934
      }, {
        value: 1,
        velocity: 0
      }]);
    });
    (0, _qunit.test)('underdamped spring', function (assert) {
      let underdampedSpring = new _spring.default({
        stiffness: 100,
        damping: 10,
        mass: 1
      });
      assert.deepEqual(underdampedSpring.toFrames({
        from: 0,
        to: 1
      }), [{
        value: 0,
        velocity: 0
      }, {
        value: 0.01311832586992645,
        velocity: 0.0015280885700403079
      }, {
        value: 0.04941510804510185,
        velocity: 0.0027825797446520348
      }, {
        value: 0.10440547345507933,
        velocity: 0.003773452034749069
      }, {
        value: 0.1738158635405722,
        velocity: 0.004515881528317108
      }, {
        value: 0.2536606857419862,
        velocity: 0.0050290565638031835
      }, {
        value: 0.3402998466082985,
        velocity: 0.00533507195114693
      }, {
        value: 0.430478632885834,
        velocity: 0.005457918755914951
      }, {
        value: 0.5213516324407461,
        velocity: 0.005422580763871937
      }, {
        value: 0.6104925345574281,
        velocity: 0.005254244313351903
      }, {
        value: 0.695891727212196,
        velocity: 0.004977624262194077
      }, {
        value: 0.7759436260445078,
        velocity: 0.0046164054666648965
      }, {
        value: 0.8494256348541123,
        velocity: 0.004192796296663319
      }, {
        value: 0.9154705594181388,
        velocity: 0.00372718838511412
      }, {
        value: 0.973534183862093,
        velocity: 0.0032379149883166444
      }, {
        value: 1.0233595799066921,
        velocity: 0.002741098987057026
      }, {
        value: 1.0649395616400008,
        velocity: 0.002250580647099635
      }, {
        value: 1.0984785289364258,
        velocity: 0.0017779147386102314
      }, {
        value: 1.1243547674084118,
        velocity: 0.001332426440180411
      }, {
        value: 1.1430840971826612,
        velocity: 0.0009213155758676852
      }, {
        value: 1.15528559137785,
        velocity: 0.0005497991043667012
      }, {
        value: 1.1616499216592626,
        velocity: 0.0002212823505560672
      }, {
        value: 1.162910735616452,
        velocity: -0.00006244980412685897
      }, {
        value: 1.1598193311800509,
        velocity: -0.0003010297170894185
      }, {
        value: 1.1531227684140493,
        velocity: -0.0004952987974191495
      }, {
        value: 1.1435454497289794,
        velocity: -0.000647100415508969
      }, {
        value: 1.1317741062562134,
        velocity: -0.0007590790275391475
      }, {
        value: 1.1184460507317273,
        velocity: -0.0008344896885182705
      }, {
        value: 1.10414049529181,
        velocity: -0.000877021221654635
      }, {
        value: 1.089372685293384,
        velocity: -0.0008906354615585563
      }, {
        value: 1.074590566595033,
        velocity: -0.000879424207325128
      }, {
        value: 1.0601736824413142,
        velocity: -0.0008474848182992072
      }, {
        value: 1.0464339858249985,
        velocity: -0.00079881476622618
      }, {
        value: 1.0336182525290103,
        velocity: -0.0007372249254287452
      }, {
        value: 1.0219117875161923,
        velocity: -0.0006662709378421994
      }, {
        value: 1.0114431315004955,
        velocity: -0.0005892016301478996
      }, {
        value: 1.0022894940077183,
        velocity: -0.0005089231819640907
      }, {
        value: 0.9944826627053691,
        velocity: -0.00042797754170590915
      }, {
        value: 0.9880151650367869,
        velocity: -0.00034853345382034344
      }, {
        value: 0.9828464861367362,
        velocity: -0.0002723883903694983
      }, {
        value: 0.9789091756620557,
        velocity: -0.00020097966363743434
      }, {
        value: 0.9761147047004372,
        velocity: -0.00013540302663157908
      }, {
        value: 0.9743589616142305,
        velocity: -0.00007643713713069433
      }, {
        value: 0.9735273019556582,
        velocity: -0.000024572360618388932
      }, {
        value: 0.9734990920012613,
        velocity: 0.000019957489255270614
      }, {
        value: 0.9741517076604145,
        velocity: 0.00005714173389446873
      }, {
        value: 0.9753639702868705,
        velocity: 0.00008715884704400709
      }, {
        value: 0.9770190181322469,
        velocity: 0.00011034286050725949
      }, {
        value: 0.9790066267804659,
        velocity: 0.00012715095623345285
      }, {
        value: 0.9812250039203692,
        velocity: 0.0001381328899292665
      }, {
        value: 0.9835820933396238,
        velocity: 0.00014390274555290043
      }, {
        value: 0.9859964301960646,
        velocity: 0.0001451133838871894
      }, {
        value: 0.9883975946208738,
        velocity: 0.00014243382385863615
      }, {
        value: 0.9907263137377673,
        velocity: 0.00013652968376462416
      }, {
        value: 0.9929342634684901,
        velocity: 0.00012804671193834545
      }, {
        value: 0.9949836212722638,
        velocity: 0.00011759735298285918
      }, {
        value: 0.9968464194727022,
        velocity: 0.00010575022648582594
      }, {
        value: 0.9985037462934381,
        velocity: 0.00009302233967521533
      }, {
        value: 1,
        velocity: 0
      }]);
    });
    (0, _qunit.test)('critically damped spring', function (assert) {
      let criticallydampedSpring = new _spring.default({
        stiffness: 100,
        damping: 20,
        mass: 1
      });
      assert.deepEqual(criticallydampedSpring.toFrames({
        from: 0,
        to: 1
      }), [{
        value: 0,
        velocity: 0
      }, {
        value: 0.012437987627616942,
        velocity: 0.0014108028748176901
      }, {
        value: 0.04462491923494771,
        velocity: 0.0023884377019126306
      }, {
        value: 0.09020401043104986,
        velocity: 0.003032653298563167
      }, {
        value: 0.1443048016123466,
        velocity: 0.0034227807935506135
      }, {
        value: 0.2032366177370234,
        velocity: 0.0036216517375589853
      }, {
        value: 0.26424111765711555,
        velocity: 0.003678794411714423
      }, {
        value: 0.32529301485170514,
        velocity: 0.0036330376123369723
      }, {
        value: 0.38494001106330433,
        velocity: 0.0035146285082096897
      }, {
        value: 0.44217459962892547,
        velocity: 0.0033469524022264477
      }, {
        value: 0.49633172576650164,
        velocity: 0.003147926713959365
      }, {
        value: 0.547007386107534,
        velocity: 0.002931128678127722
      }, {
        value: 0.5939941502901618,
        velocity: 0.0027067056647322543
      }, {
        value: 0.6372303273564889,
        velocity: 0.002482108286508234
      }, {
        value: 0.6767601071186498,
        velocity: 0.002262679250169452
      }, {
        value: 0.7127025048163542,
        velocity: 0.0020521249655974703
      }, {
        value: 0.7452273455163944,
        velocity: 0.001852892032608041
      }, {
        value: 0.7745368587040187,
        velocity: 0.001666466696535514
      }, {
        value: 0.8008517265285442,
        velocity: 0.0014936120510359184
      }, {
        value: 0.8244006520446817,
        velocity: 0.001334555044460419
      }, {
        value: 0.8454126954952397,
        velocity: 0.0011891331115750795
      }, {
        value: 0.8641117745995668,
        velocity: 0.0010569084197811474
      }, {
        value: 0.8807128450362989,
        velocity: 0.0009372562175719375
      }, {
        value: 0.8954193748557835,
        velocity: 0.0008294325442472347
      }, {
        value: 0.9084218055563291,
        velocity: 0.0007326255555493669
      }, {
        value: 0.9198967564051186,
        velocity: 0.0006459938999587211
      }, {
        value: 0.9300067800696483,
        velocity: 0.0005686949119341078
      }, {
        value: 0.9389005190396674,
        velocity: 0.0004999048442209032
      }, {
        value: 0.9467131455415272,
        velocity: 0.0004388329190697757
      }, {
        value: 0.9535669942158791,
        velocity: 0.0003847306193541442
      }, {
        value: 0.9595723180054873,
        velocity: 0.00033689734995427266
      }, {
        value: 0.9648281145122878,
        velocity: 0.0002946833648970487
      }, {
        value: 0.969422983372401,
        velocity: 0.00025749066633767647
      }, {
        value: 0.9734359856499836,
        velocity: 0.00022477242911552353
      }, {
        value: 0.9769374844235683,
        velocity: 0.0001960313823996695
      }, {
        value: 0.9799899520854091,
        velocity: 0.00017081748219772755
      }, {
        value: 0.9826487347633355,
        velocity: 0.0001487251305999815
      }, {
        value: 0.9849627680037535,
        velocity: 0.00012939013578165578
      }, {
        value: 0.9869752406646145,
        velocity: 0.00011248655789651067
      }, {
        value: 0.9887242060526682,
        velocity: 0.00009772354754354227
      }, {
        value: 0.9902431408563948,
        velocity: 0.000084842253422654
      }, {
        value: 0.9915614535000543,
        velocity: 0.00007361285244633517
      }, {
        value: 0.9927049442755639,
        velocity: 0.00006383173758881623
      }, {
        value: 0.9936962200773563,
        velocity: 0.000055318885035444956
      }, {
        value: 0.9945550668344385,
        velocity: 0.00004791541185694135
      }, {
        value: 0.9952987828537434,
        velocity: 0.00004148132776108765
      }, {
        value: 0.9959424762990092,
        velocity: 0.000035893478893379674
      }, {
        value: 0.9964993299607008,
        velocity: 0.00003104367770699274
      }, {
        value: 0.9969808363488774,
        velocity: 0.000026837010232201053
      }, {
        value: 0.9973970059808868,
        velocity: 0.000023190310352099363
      }, {
        value: 0.9977565515534178,
        velocity: 0.00002003078970162627
      }, {
        value: 0.9980670504943989,
        velocity: 0.000017294811365904836
      }, {
        value: 0.9983350881923788,
        velocity: 0.000014926795516603616
      }, {
        value: 0.9985663840051094,
        velocity: 0.00001287824537782997
      }, {
        value: 0.9987659019591332,
        velocity: 0.000011106882367801231
      }, {
        value: 0.9989379478710443,
        velocity: 0.000009575879851239716
      }, {
        value: 1,
        velocity: 0
      }]);
    });
    (0, _qunit.test)('overdamped spring', function (assert) {
      let overdampedSpring = new _spring.default({
        stiffness: 100,
        damping: 25,
        mass: 1,
        allowsOverdamping: true
      });
      assert.deepEqual(overdampedSpring.toFrames({
        from: 0,
        to: 1
      }), [{
        value: 0,
        velocity: 0
      }, {
        value: 0.012117884018832292,
        velocity: 0.0013567540270368935
      }, {
        value: 0.04249673982337865,
        velocity: 0.0022204307057201444
      }, {
        value: 0.08422543629527413,
        velocity: 0.0027394756126664175
      }, {
        value: 0.13249063194019006,
        velocity: 0.003019561149720417
      }, {
        value: 0.18397102734526227,
        velocity: 0.0031357668490858805
      }, {
        value: 0.23640421479535967,
        velocity: 0.0031413025098401383
      }, {
        value: 0.2882771282614057,
        velocity: 0.003073754519370947
      }, {
        value: 0.33860499169747793,
        velocity: 0.0029595577853986053
      }, {
        value: 0.38677361913460173,
        velocity: 0.002817196562487673
      }, {
        value: 0.43242705310631335,
        velocity: 0.0026594947677321705
      }, {
        value: 0.47538763860903943,
        velocity: 0.002495254140922265
      }, {
        value: 0.5155992914009884,
        velocity: 0.0023304253485513867
      }, {
        value: 0.5530873427699907,
        velocity: 0.002168944642465341
      }, {
        value: 0.5879302222977014,
        velocity: 0.002013331075754017
      }, {
        value: 0.6202395865194417,
        velocity: 0.001865112332407365
      }, {
        value: 0.6501464658436414,
        velocity: 0.0017251279208126357
      }, {
        value: 0.6777916929312899,
        velocity: 0.0015937446486612274
      }, {
        value: 0.7033193705276489,
        velocity: 0.001471009386478424
      }, {
        value: 0.7268724910753659,
        velocity: 0.0013567570268944989
      }, {
        value: 0.7485900741503642,
        velocity: 0.0012506864602414805
      }, {
        value: 0.7686053693879248,
        velocity: 0.0011524137432326039
      }, {
        value: 0.7870448025536975,
        velocity: 0.0010615090273321756
      }, {
        value: 0.8040274354132486,
        velocity: 0.0009775219438754928
      }, {
        value: 0.8196647765604841,
        velocity: 0.000899998804058067
      }, {
        value: 0.834060827899976,
        velocity: 0.000828494013118022
      }, {
        value: 0.8473122854284034,
        velocity: 0.0007625774115781786
      }, {
        value: 0.8595088371855433,
        velocity: 0.00070183876505185
      }, {
        value: 0.8707335185103466,
        velocity: 0.0006458902725049675
      }, {
        value: 0.8810630970230116,
        velocity: 0.0005943677113545693
      }, {
        value: 0.8905684684780559,
        velocity: 0.0005469306579609079
      }, {
        value: 0.8993150508120259,
        velocity: 0.0005032620935840068
      }, {
        value: 0.9073631680699791,
        velocity: 0.00046306761414439024
      }, {
        value: 0.9147684189579867,
        velocity: 0.00042607439670611525
      }, {
        value: 0.921582026907279,
        velocity: 0.0003920300290058252
      }, {
        value: 0.9278511700159389,
        velocity: 0.00036070127522479256
      }, {
        value: 0.9336192902469659,
        velocity: 0.00033187282770340395
      }, {
        value: 0.9389263819433481,
        velocity: 0.0003053460776806097
      }, {
        value: 0.9438092601688999,
        velocity: 0.0002809379264364749
      }, {
        value: 0.9483018096675063,
        velocity: 0.0002584796500154336
      }, {
        value: 0.9524352154025942,
        velocity: 0.00023781582500306738
      }, {
        value: 0.9562381757283864,
        velocity: 0.00021880331889900692
      }, {
        value: 0.959737099279815,
        velocity: 0.00020131034595732925
      }, {
        value: 0.9629562866666219,
        velocity: 0.000185215587585076
      }, {
        value: 0.9659180980316832,
        velocity: 0.00017040737523618725
      }, {
        value: 0.9686431074927613,
        velocity: 0.0001567829330245908
      }, {
        value: 0.9711502454368727,
        velocity: 0.00014424767687268346
      }, {
        value: 0.9734569295815177,
        velocity: 0.00013271456681497061
      }, {
        value: 0.9755791856600793,
        velocity: 0.00012210350902373
      }, {
        value: 0.9775317585317287,
        velocity: 0.00011234080416647546
      }, {
        value: 0.9793282144604826,
        velocity: 0.000103358638810161
      }, {
        value: 0.98098103525446,
        velocity: 0.00009509461673081404
      }, {
        value: 0.9825017049053953,
        velocity: 0.00008749132715327334
      }, {
        value: 0.9839007893203391,
        velocity: 0.00008049594712255959
      }, {
        value: 0.9851880096923368,
        velocity: 0.00007405987538841729
      }, {
        value: 0.986372310014724,
        velocity: 0.00006813839536259338
      }, {
        value: 0.9874619192044505,
        velocity: 0.00006269036488108608
      }, {
        value: 0.988464408263438,
        velocity: 0.00005767793066882812
      }, {
        value: 0.989386742873251,
        velocity: 0.00005306626556084932
      }, {
        value: 0.9902353317871699,
        velocity: 0.00004882332668129213
      }, {
        value: 0.9910160713549372,
        velocity: 0.000044919632919545815
      }, {
        value: 0.9917343864888577,
        velocity: 0.00004132806017130614
      }, {
        value: 0.9923952683554006,
        velocity: 0.00003802365293183913
      }, {
        value: 0.9930033090538435,
        velocity: 0.000034983450939502394
      }, {
        value: 0.9935627335226628,
        velocity: 0.00003218632967011508
      }, {
        value: 0.9940774288951881,
        velocity: 0.00002961285357755119
      }, {
        value: 0.9945509715083635,
        velocity: 0.00002724514106344842
      }, {
        value: 0.9949866517521907,
        velocity: 0.000025066740239675953
      }, {
        value: 0.9953874969324523,
        velocity: 0.000023062514621658002
      }, {
        value: 0.9957562923055266,
        velocity: 0.0000212185379592725
      }, {
        value: 0.996095600431419,
        velocity: 0.00001952199747525742
      }, {
        value: 0.9964077789794578,
        velocity: 0.000017961104839279876
      }, {
        value: 0.996694997110362,
        velocity: 0.000016525014259433422
      }, {
        value: 0.9969592505484938,
        velocity: 0.000015203747122280922
      }, {
        value: 0.9972023754490196,
        velocity: 0.000013988122657991422
      }, {
        value: 0.9974260611563257,
        velocity: 0.00001286969414893177
      }, {
        value: 0.9976318619423379,
        velocity: 0.000011840690238554848
      }, {
        value: 0.9978212078063018,
        velocity: 0.000010893960932839616
      }, {
        value: 0.9979954144110663,
        velocity: 0.00001002292791912321
      }, {
        value: 0.9981556922249085,
        velocity: 0.000009221538857153365
      }, {
        value: 0.9983031549324213,
        velocity: 0.000008484225324778078
      }, {
        value: 0.998438827172905,
        velocity: 0.000007805864126077613
      }, {
        value: 0.9985636516600326,
        velocity: 0.000007181741693103174
      }, {
        value: 0.9986784957322595,
        velocity: 0.0000066075213338772975
      }, {
        value: 0.9987841573794911,
        velocity: 0.000006079213099087144
      }, {
        value: 0.9988813707878856,
        velocity: 0.000005593146058094666
      }, {
        value: 0.9989708114413194,
        velocity: 0.000005145942791628189
      }, {
        value: 1,
        velocity: 0
      }]);
      let overdampedSpringWithoutOverdamping = new _spring.default({
        stiffness: 100,
        damping: 25,
        mass: 1,
        allowsOverdamping: false
      });
      assert.deepEqual(overdampedSpringWithoutOverdamping.toFrames({
        from: 0,
        to: 1
      }), [{
        value: 0,
        velocity: 0
      }, {
        value: 0.012437987627616942,
        velocity: 0.0014108028748176901
      }, {
        value: 0.04462491923494771,
        velocity: 0.0023884377019126306
      }, {
        value: 0.09020401043104986,
        velocity: 0.003032653298563167
      }, {
        value: 0.1443048016123466,
        velocity: 0.0034227807935506135
      }, {
        value: 0.2032366177370234,
        velocity: 0.0036216517375589853
      }, {
        value: 0.26424111765711555,
        velocity: 0.003678794411714423
      }, {
        value: 0.32529301485170514,
        velocity: 0.0036330376123369723
      }, {
        value: 0.38494001106330433,
        velocity: 0.0035146285082096897
      }, {
        value: 0.44217459962892547,
        velocity: 0.0033469524022264477
      }, {
        value: 0.49633172576650164,
        velocity: 0.003147926713959365
      }, {
        value: 0.547007386107534,
        velocity: 0.002931128678127722
      }, {
        value: 0.5939941502901618,
        velocity: 0.0027067056647322543
      }, {
        value: 0.6372303273564889,
        velocity: 0.002482108286508234
      }, {
        value: 0.6767601071186498,
        velocity: 0.002262679250169452
      }, {
        value: 0.7127025048163542,
        velocity: 0.0020521249655974703
      }, {
        value: 0.7452273455163944,
        velocity: 0.001852892032608041
      }, {
        value: 0.7745368587040187,
        velocity: 0.001666466696535514
      }, {
        value: 0.8008517265285442,
        velocity: 0.0014936120510359184
      }, {
        value: 0.8244006520446817,
        velocity: 0.001334555044460419
      }, {
        value: 0.8454126954952397,
        velocity: 0.0011891331115750795
      }, {
        value: 0.8641117745995668,
        velocity: 0.0010569084197811474
      }, {
        value: 0.8807128450362989,
        velocity: 0.0009372562175719375
      }, {
        value: 0.8954193748557835,
        velocity: 0.0008294325442472347
      }, {
        value: 0.9084218055563291,
        velocity: 0.0007326255555493669
      }, {
        value: 0.9198967564051186,
        velocity: 0.0006459938999587211
      }, {
        value: 0.9300067800696483,
        velocity: 0.0005686949119341078
      }, {
        value: 0.9389005190396674,
        velocity: 0.0004999048442209032
      }, {
        value: 0.9467131455415272,
        velocity: 0.0004388329190697757
      }, {
        value: 0.9535669942158791,
        velocity: 0.0003847306193541442
      }, {
        value: 0.9595723180054873,
        velocity: 0.00033689734995427266
      }, {
        value: 0.9648281145122878,
        velocity: 0.0002946833648970487
      }, {
        value: 0.969422983372401,
        velocity: 0.00025749066633767647
      }, {
        value: 0.9734359856499836,
        velocity: 0.00022477242911552353
      }, {
        value: 0.9769374844235683,
        velocity: 0.0001960313823996695
      }, {
        value: 0.9799899520854091,
        velocity: 0.00017081748219772755
      }, {
        value: 0.9826487347633355,
        velocity: 0.0001487251305999815
      }, {
        value: 0.9849627680037535,
        velocity: 0.00012939013578165578
      }, {
        value: 0.9869752406646145,
        velocity: 0.00011248655789651067
      }, {
        value: 0.9887242060526682,
        velocity: 0.00009772354754354227
      }, {
        value: 0.9902431408563948,
        velocity: 0.000084842253422654
      }, {
        value: 0.9915614535000543,
        velocity: 0.00007361285244633517
      }, {
        value: 0.9927049442755639,
        velocity: 0.00006383173758881623
      }, {
        value: 0.9936962200773563,
        velocity: 0.000055318885035444956
      }, {
        value: 0.9945550668344385,
        velocity: 0.00004791541185694135
      }, {
        value: 0.9952987828537434,
        velocity: 0.00004148132776108765
      }, {
        value: 0.9959424762990092,
        velocity: 0.000035893478893379674
      }, {
        value: 0.9964993299607008,
        velocity: 0.00003104367770699274
      }, {
        value: 0.9969808363488774,
        velocity: 0.000026837010232201053
      }, {
        value: 0.9973970059808868,
        velocity: 0.000023190310352099363
      }, {
        value: 0.9977565515534178,
        velocity: 0.00002003078970162627
      }, {
        value: 0.9980670504943989,
        velocity: 0.000017294811365904836
      }, {
        value: 0.9983350881923788,
        velocity: 0.000014926795516603616
      }, {
        value: 0.9985663840051094,
        velocity: 0.00001287824537782997
      }, {
        value: 0.9987659019591332,
        velocity: 0.000011106882367801231
      }, {
        value: 0.9989379478710443,
        velocity: 0.000009575879851239716
      }, {
        value: 1,
        velocity: 0
      }]);
      let criticallydampedSpring = new _spring.default({
        stiffness: 100,
        damping: 20,
        mass: 1
      });
      assert.deepEqual(overdampedSpringWithoutOverdamping.toFrames({
        from: 0,
        to: 1
      }), criticallydampedSpring.toFrames({
        from: 0,
        to: 1
      }));
    });
    (0, _qunit.test)('takes a delay into account', function (assert) {
      let clampedSpring = new _spring.default({
        overshootClamping: true
      });
      let frames = clampedSpring.toFrames({
        from: 0,
        to: 1,
        delay: 50
      });
      assert.equal(frames.length, 19);
      assert.deepEqual(frames, [{
        value: 0,
        velocity: 0
      }, {
        value: 0,
        velocity: 0
      }, {
        value: 0,
        velocity: 0
      }, {
        value: 0,
        velocity: 0
      }, {
        value: 0.01311832586992645,
        velocity: 0.0015280885700403079
      }, {
        value: 0.04941510804510185,
        velocity: 0.0027825797446520348
      }, {
        value: 0.10440547345507933,
        velocity: 0.003773452034749069
      }, {
        value: 0.1738158635405722,
        velocity: 0.004515881528317108
      }, {
        value: 0.2536606857419862,
        velocity: 0.0050290565638031835
      }, {
        value: 0.3402998466082985,
        velocity: 0.00533507195114693
      }, {
        value: 0.430478632885834,
        velocity: 0.005457918755914951
      }, {
        value: 0.5213516324407461,
        velocity: 0.005422580763871937
      }, {
        value: 0.6104925345574281,
        velocity: 0.005254244313351903
      }, {
        value: 0.695891727212196,
        velocity: 0.004977624262194077
      }, {
        value: 0.7759436260445078,
        velocity: 0.0046164054666648965
      }, {
        value: 0.8494256348541123,
        velocity: 0.004192796296663319
      }, {
        value: 0.9154705594181388,
        velocity: 0.00372718838511412
      }, {
        value: 0.973534183862093,
        velocity: 0.0032379149883166444
      }, {
        value: 1,
        velocity: 0
      }]);
    });
    (0, _qunit.test)('takes previous velocity into account', function (assert) {
      let clampedSpring = new _spring.default({
        overshootClamping: true
      });
      let frames = clampedSpring.toFrames({
        from: 0,
        to: 1,
        velocity: 0.01
      });
      assert.equal(frames.length, 20);
      assert.deepEqual(frames, [{
        value: 0,
        velocity: -0.009999999999999998
      }, {
        value: -0.13969053113410435,
        velocity: -0.006812639601220119
      }, {
        value: -0.22884286642010165,
        velocity: -0.003940689430244914
      }, {
        value: -0.2729397300198275,
        velocity: -0.0014090411959510694
      }, {
        value: -0.2777722892911385,
        velocity: 0.0007699216920399373
      }, {
        value: -0.24924497063833218,
        velocity: 0.0025947199850262265
      }, {
        value: -0.19320734850639454,
        velocity: 0.004073142368376845
      }, {
        value: -0.1153132427056609,
        velocity: 0.00522062384068824
      }, {
        value: -0.020906443946447695,
        velocity: 0.006058677852151335
      }, {
        value: 0.0850681032222379,
        velocity: 0.0066134139722780864
      }, {
        value: 0.19812930099278847,
        velocity: 0.006914165796510115
      }, {
        value: 0.31430307937801827,
        velocity: 0.00699224719377487
      }, {
        value: 0.43014600518778046,
        velocity: 0.00687984894186776
      }, {
        value: 0.5427517209067267,
        velocity: 0.006609082364409629
      }, {
        value: 0.6497426850304286,
        velocity: 0.006211171815254218
      }, {
        value: 0.7492496812009896,
        velocity: 0.005715793773180974
      }, {
        value: 0.8398814969300373,
        velocity: 0.005150556910599277
      }, {
        value: 0.9206870550754027,
        velocity: 0.00454061476658472
      }, {
        value: 0.9911121233903707,
        velocity: 0.003908400554444941
      }, {
        value: 1,
        velocity: 0
      }]);
      frames = clampedSpring.toFrames({
        from: 0,
        to: 1,
        velocity: -0.01
      });
      assert.equal(frames.length, 9);
      assert.deepEqual(frames, [{
        value: 0,
        velocity: 0.01
      }, {
        value: 0.16592718287395725,
        velocity: 0.009868816741300735
      }, {
        value: 0.32767308251030525,
        velocity: 0.009505848919548983
      }, {
        value: 0.4817506769299862,
        velocity: 0.008955945265449206
      }, {
        value: 0.6254040163722829,
        velocity: 0.008261841364594279
      }, {
        value: 0.7565663421223043,
        velocity: 0.007463393142580138
      }, {
        value: 0.8738070417229914,
        velocity: 0.006597001533917015
      }, {
        value: 0.976270508477329,
        velocity: 0.00569521367114166
      }, {
        value: 1,
        velocity: 0
      }]);
      frames = clampedSpring.toFrames({
        from: 0,
        to: 1,
        velocity: -1
      });
      assert.equal(frames.length, 2);
      assert.deepEqual(frames, [{
        value: 0,
        velocity: 1
      }, {
        value: 1,
        velocity: 0
      }]);
    }); // TODO: I don't think passing a velocity together with a delay makes too much sense

    (0, _qunit.test)('takes previous velocity and delay into account', function (assert) {
      let clampedSpring = new _spring.default({
        overshootClamping: true
      });
      let frames = clampedSpring.toFrames({
        from: 0.25,
        to: 1,
        velocity: -0.01,
        delay: 50
      });
      assert.equal(frames.length, 10);
      assert.deepEqual(frames, [{
        value: 0.25,
        velocity: 0
      }, {
        value: 0.25,
        velocity: 0
      }, {
        value: 0.25,
        velocity: 0
      }, {
        value: 0.25,
        velocity: 0.01
      }, {
        value: 0.4126476014064757,
        velocity: 0.009486794598790657
      }, {
        value: 0.5653193054990298,
        velocity: 0.008810203983385974
      }, {
        value: 0.7056493085662163,
        velocity: 0.008012582256761939
      }, {
        value: 0.83195005048714,
        velocity: 0.007132870982515002
      }, {
        value: 0.9431511706868079,
        velocity: 0.006206129001629344
      }, {
        value: 1,
        velocity: 0
      }]);
    });
  });
});
define("animations/tests/unit/models/sprite-tree-test", ["animations/models/sprite-tree", "qunit"], function (_spriteTree, _qunit) {
  "use strict";

  function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

  class MockAnimationContext {
    constructor(parentEl = null, id = undefined) {
      _defineProperty(this, "id", void 0);

      _defineProperty(this, "element", void 0);

      _defineProperty(this, "isAnimationContext", true);

      this.element = document.createElement('div');

      if (parentEl) {
        parentEl.appendChild(this.element);
      }

      this.id = id;
    }

  }

  class MockSpriteModifier {
    constructor(parentEl = null) {
      _defineProperty(this, "element", void 0);

      _defineProperty(this, "farMatch", false);

      _defineProperty(this, "id", 'Mock');

      this.element = document.createElement('div');

      if (parentEl) {
        parentEl.appendChild(this.element);
      }
    }

  }

  (0, _qunit.module)('Unit | Models | SpriteTree', function (hooks) {
    let subject;
    hooks.beforeEach(function () {
      subject = new _spriteTree.default();
    });
    (0, _qunit.module)('empty', function () {
      (0, _qunit.test)('constructing an empty tree', function (assert) {
        assert.ok(subject);
        assert.equal(subject.rootNodes.size, 0, 'tree has no rootNodes initially');
      });
      (0, _qunit.test)('adding a root animation context node', function (assert) {
        let context = new MockAnimationContext();
        let node = subject.addAnimationContext(context);
        assert.ok(node, 'addAnimationContext returns a node');
        assert.equal(node, subject.lookupNodeByElement(context.element), 'can lookup node after adding it');
        assert.equal(node.isRoot, true, 'context node with none above it isRoot');
        assert.equal(node.children.size, 0, 'context node has no children yet');
        assert.equal(subject.rootNodes.size, 1, 'tree has one rootNode');
        assert.equal(Array.from(subject.rootNodes)[0], node, 'tree has context node has root node');
      });
      (0, _qunit.test)('adding a sprite modifier and then its parent animation context node', function (assert) {
        let context = new MockAnimationContext();
        let spriteModifier = new MockSpriteModifier(context.element);
        let spriteModifierNode = subject.addSpriteModifier(spriteModifier);
        let contextNode = subject.addAnimationContext(context);
        assert.equal(contextNode.isRoot, true, 'context node with none above it isRoot');
        assert.equal(spriteModifierNode.isRoot, false, 'spriteModifier node under context is not isRoot');
        assert.equal(spriteModifierNode.children.size, 0, 'spriteModifierNode node has no children yet');
        assert.equal(contextNode.children.size, 1, 'context node has one childNode');
        assert.equal(subject.rootNodes.size, 1, 'tree has one rootNode');
        assert.equal(Array.from(subject.rootNodes)[0], contextNode, 'tree has context node as root node');
        assert.equal(Array.from(contextNode.children)[0], spriteModifierNode, 'context node has one has sprite node as child');
      });
    });
    (0, _qunit.module)('with a context node', function (hooks) {
      let context, contextNode;
      hooks.beforeEach(function () {
        context = new MockAnimationContext();
        contextNode = subject.addAnimationContext(context);
      });
      (0, _qunit.test)('adding a sprite modifier directly under context', function (assert) {
        let spriteModifer = new MockSpriteModifier(context.element);
        let spriteNode = subject.addSpriteModifier(spriteModifer);
        assert.ok(spriteNode, 'addSpriteModifier returns a node');
        assert.equal(spriteNode, subject.lookupNodeByElement(spriteModifer.element), 'can lookup node after adding it');
        assert.equal(spriteNode.isRoot, false, 'sprite node nested under a context has isRoot false');
        assert.equal(spriteNode.parent, contextNode, 'sprite node has its parent set correctly');
        assert.equal(contextNode.children.size, 1, 'context node has one childNode');
        assert.equal(Array.from(contextNode.children)[0], spriteNode, 'context node has sprite node as child');
      });
      (0, _qunit.test)('adding a sprite modifier under context with other elements in between', function (assert) {
        let context = new MockAnimationContext();
        let contextNode = subject.addAnimationContext(context);
        let elementBetweenContextAndSprite = document.createElement('div');
        context.element.appendChild(elementBetweenContextAndSprite);
        let elementBetweenContextAndSprite2 = document.createElement('div');
        elementBetweenContextAndSprite.appendChild(elementBetweenContextAndSprite2);
        let spriteModifer = new MockSpriteModifier(elementBetweenContextAndSprite2);
        let spriteNode = subject.addSpriteModifier(spriteModifer);
        assert.ok(spriteNode, 'addSpriteModifier returns a node');
        assert.equal(spriteNode, subject.lookupNodeByElement(spriteModifer.element), 'can lookup node after adding it');
        assert.equal(spriteNode.isRoot, false, 'sprite node nested under a context has isRoot false');
        assert.equal(spriteNode.parent, contextNode, 'sprite node has its parent set correctly');
      });
      (0, _qunit.test)('adding a context nested under another context', function (assert) {
        let nestedContext = new MockAnimationContext(context.element);
        let nestedContextNode = subject.addAnimationContext(nestedContext);
        assert.equal(nestedContextNode.isRoot, false, 'context node nested under a context has isRoot false');
        assert.equal(nestedContextNode.parent, contextNode, 'nested context node has its parent set correctly');
      });
      (0, _qunit.test)('remove an animation context', function (assert) {
        subject.removeAnimationContext(context);
        assert.equal(subject.lookupNodeByElement(context.element), null, 'can no longer lookup node after removing it');
        assert.equal(subject.rootNodes.size, 0, 'tree has no rootNodes left');
      });
      (0, _qunit.test)('getting a context run list', function (assert) {
        assert.deepEqual(subject.getContextRunList(new Set([context])), [context]);
      });
    });
    (0, _qunit.module)('with a context node and nested sprite modifier', function (hooks) {
      let context, contextNode, spriteModifer, spriteNode;
      hooks.beforeEach(function () {
        context = new MockAnimationContext();
        contextNode = subject.addAnimationContext(context);
        spriteModifer = new MockSpriteModifier(context.element);
        spriteNode = subject.addSpriteModifier(spriteModifer);
      });
      (0, _qunit.test)('adding a sprite modifier under another sprite modifier', function (assert) {
        let nestedSpriteModifer = new MockSpriteModifier(spriteModifer.element);
        let nestedSpriteNode = subject.addSpriteModifier(nestedSpriteModifer);
        assert.equal(nestedSpriteNode.isRoot, false, 'sprite node nested under a sprite has isRoot false');
        assert.equal(nestedSpriteNode.parent, spriteNode, 'nested sprite node has its parent set correctly');
        let descendants = subject.descendantsOf(context);
        assert.equal(descendants.length, 2, 'the context has two descendants');
        assert.equal(descendants[0], spriteModifer, 'the first descendant is the spriteModifier');
        assert.equal(descendants[1], nestedSpriteModifer, 'the second descendant is the nested spriteModifier');
      });
      (0, _qunit.test)('remove a sprite modifier', function (assert) {
        subject.removeSpriteModifier(spriteModifer);
        assert.equal(subject.lookupNodeByElement(spriteModifer.element), null, 'can no longer lookup node after removing it');
        assert.equal(contextNode.children.size, 0, 'context node has no children yet');
        assert.equal(contextNode.freshlyRemovedChildren.size, 1, 'context node has no freshlyRemovedChildren yet');
        assert.equal(Array.from(contextNode.freshlyRemovedChildren)[0], spriteNode, 'context node has removed spriteNode in freshlyRemovedChildren');
        let descendants = subject.descendantsOf(context);
        assert.equal(descendants.length, 0, 'the context has no descendants');
        let descendantsWithFreshRemovals = subject.descendantsOf(context, {
          includeFreshlyRemoved: true
        });
        assert.equal(descendantsWithFreshRemovals.length, 1, 'descendants includes freshly removed when flag is passed');
        assert.equal(descendantsWithFreshRemovals[0], spriteModifer, 'the returned descendant is the removed spriteModifier');
      });
    });
    (0, _qunit.module)('with two context nodes, each with a sprite', function (hooks) {
      let context1, context2, sprite1, sprite2;
      hooks.beforeEach(function () {
        context1 = new MockAnimationContext();
        context2 = new MockAnimationContext();
        sprite1 = new MockSpriteModifier(context1.element);
        sprite2 = new MockSpriteModifier(context2.element);
        subject.addAnimationContext(context1);
        subject.addAnimationContext(context2);
        subject.addSpriteModifier(sprite1);
        subject.addSpriteModifier(sprite2);
      });
      (0, _qunit.test)('if a sprite is removed from one context, it is eligible for farmatching to another', function (assert) {
        subject.removeSpriteModifier(sprite1);
        assert.equal(subject.farMatchCandidatesFor(context2).length, 1);
        assert.equal(subject.farMatchCandidatesFor(context2)[0], sprite1);
        assert.equal(subject.farMatchCandidatesFor(context1).length, 0);
        subject.clearFreshlyRemovedChildren();
        assert.equal(subject.farMatchCandidatesFor(context2).length, 0);
        assert.equal(subject.farMatchCandidatesFor(context1).length, 0);
      });
      (0, _qunit.test)('getting a context run list', function (assert) {
        assert.deepEqual(subject.getContextRunList(new Set([context1])), [context1]);
        assert.deepEqual(subject.getContextRunList(new Set([context2])), [context2]);
        assert.deepEqual(subject.getContextRunList(new Set([context1, context2])), [context1, context2]);
      });
    });
    (0, _qunit.module)('with a sprite modifier nested under another sprite modifier', function (hooks) {
      let context, spriteModifer, spriteNode, nestedSpriteModifer, nestedSpriteNode;
      hooks.beforeEach(function () {
        context = new MockAnimationContext();
        subject.addAnimationContext(context);
        spriteModifer = new MockSpriteModifier(context.element);
        spriteNode = subject.addSpriteModifier(spriteModifer);
        nestedSpriteModifer = new MockSpriteModifier(spriteModifer.element);
        nestedSpriteNode = subject.addSpriteModifier(nestedSpriteModifer);
      });
      (0, _qunit.test)('removing nested modifiers results in both being freshlyRemoved', function (assert) {
        let otherContext = new MockAnimationContext();
        subject.addAnimationContext(otherContext);
        subject.removeSpriteModifier(nestedSpriteModifer);
        subject.removeSpriteModifier(spriteModifer);
        assert.equal(nestedSpriteNode.parent, spriteNode, 'nested sprite node has its parent set correctly');
        let farMatchCandidates = subject.farMatchCandidatesFor(otherContext);
        assert.equal(farMatchCandidates.length, 2, 'farMatchCandidates include both removed sprites');
        assert.equal(farMatchCandidates[0], spriteModifer);
        assert.equal(farMatchCandidates[1], nestedSpriteModifer);
      });
    });
    (0, _qunit.module)('with two contexts nested under another context', function (hooks) {
      let parentContext, childContext1, childContext2;
      hooks.beforeEach(function () {
        parentContext = new MockAnimationContext(null, 'parentContext');
        subject.addAnimationContext(parentContext);
        childContext1 = new MockAnimationContext(parentContext.element, 'childContext1');
        subject.addAnimationContext(childContext1);
        childContext2 = new MockAnimationContext(parentContext.element, 'childContext2');
        subject.addAnimationContext(childContext2);
      });
      (0, _qunit.test)('getting a context run list', function (assert) {
        assert.deepEqual(subject.getContextRunList(new Set([parentContext])), [parentContext], 'run list for the parent context just includes the parent context');
        assert.deepEqual(subject.getContextRunList(new Set([parentContext, childContext1])), [childContext1, parentContext], 'when both parent and child are specified both are returned, with child first');
        assert.deepEqual(subject.getContextRunList(new Set([childContext1])), [childContext1, parentContext], 'when a child is specified, the run list includes the child then the parent');
        let runList = subject.getContextRunList(new Set([childContext1, childContext2]));
        assert.ok(runList[0] === childContext1 || runList[0] === childContext2, 'when two children are specified, the parent is included once, after the children');
        assert.ok(runList[1] === childContext1 || runList[1] === childContext2, 'when two children are specified, the parent is included once, after the children');
        assert.equal(runList[2], parentContext, 'when two children are specified, the parent is included once, after the children');
        assert.deepEqual(subject.getContextRunList(new Set([childContext2])), [childContext2, parentContext], 'when a child is specified, the run list includes the child then the parent');
      });
    });
  });
});
define("animations/tests/unit/services/animations-test", ["qunit", "ember-qunit"], function (_qunit, _emberQunit) {
  "use strict";

  (0, _qunit.module)('Unit | Service | animations', function (hooks) {
    (0, _emberQunit.setupTest)(hooks); // TODO: Replace this with your real tests.

    (0, _qunit.test)('it exists', function (assert) {
      let service = this.owner.lookup('service:animations');
      assert.ok(service);
    });
  });
});
define("animations/tests/unit/util/css-to-unit-value-test", ["qunit", "animations/utils/css-to-unit-value"], function (_qunit, _cssToUnitValue) {
  "use strict";

  (0, _qunit.module)('Unit | Util | CssToUnitValue', function () {
    (0, _qunit.test)('parses integers', function (assert) {
      let input = 0;
      let output = (0, _cssToUnitValue.parse)(input);
      assert.deepEqual(output, {
        value: 0,
        unit: ''
      });
    });
    (0, _qunit.test)('parses floats', function (assert) {
      let input = 0.5;
      let output = (0, _cssToUnitValue.parse)(input);
      assert.deepEqual(output, {
        value: 0.5,
        unit: ''
      });
    });
    (0, _qunit.test)('parses px', function (assert) {
      let input = '42px';
      let output = (0, _cssToUnitValue.parse)(input);
      assert.deepEqual(output, {
        value: 42,
        unit: 'px'
      });
    });
    (0, _qunit.test)('parses negative values', function (assert) {
      let input = '-42px';
      let output = (0, _cssToUnitValue.parse)(input);
      assert.deepEqual(output, {
        value: -42,
        unit: 'px'
      });
    });
    (0, _qunit.test)('parses percentages', function (assert) {
      let input = '-42%';
      let output = (0, _cssToUnitValue.parse)(input);
      assert.deepEqual(output, {
        value: -42,
        unit: '%'
      });
    });
  });
});
define("animations/tests/unit/util/instantaneous-velocity-test", ["qunit", "animations/utils/instantaneous-velocity"], function (_qunit, _instantaneousVelocity) {
  "use strict";

  (0, _qunit.module)('Unit | Util | instantaneousVelocity', function () {
    (0, _qunit.test)('calculates the instantaneous velocity in units per second (60FPS) based on the surrounding frames', function (assert) {
      let frames = [{
        value: 0,
        velocity: 0
      }, {
        value: 10,
        velocity: 0
      }, {
        value: 20,
        velocity: 0
      }];
      assert.equal((0, _instantaneousVelocity.default)(1, frames), 0.0006);
    });
    (0, _qunit.test)('returns a velocity of 0 if there is no previous frame', function (assert) {
      let frames = [{
        value: 0,
        velocity: 0
      }, {
        value: 10,
        velocity: 0
      }, {
        value: 20,
        velocity: 0
      }];
      assert.equal((0, _instantaneousVelocity.default)(0, frames), 0);
    });
    (0, _qunit.test)('returns a velocity of 0 if there is no next frame', function (assert) {
      let frames = [{
        value: 0,
        velocity: 0
      }, {
        value: 10,
        velocity: 0
      }, {
        value: 20,
        velocity: 0
      }];
      assert.equal((0, _instantaneousVelocity.default)(2, frames), 0);
    });
  });
});
define("animations/tests/unit/util/keyframe-generator-test", ["qunit", "animations/utils/keyframe-generator"], function (_qunit, _keyframeGenerator) {
  "use strict";

  (0, _qunit.module)('Unit | Util | KeyframeGenerator', function () {
    (0, _qunit.module)('generate', function () {
      (0, _qunit.test)('from single keyframe motion', function (assert) {
        let keyframeProviderStub = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0'
        }, {
          offset: 1,
          opacity: '1'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 500
        });
      });
      (0, _qunit.test)('two keyframe motions', function (assert) {
        let keyframeProviderStub1 = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let keyframeProviderStub2 = {
          keyframes: [{
            width: '10px'
          }, {
            width: '20px'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub1, keyframeProviderStub2]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0',
          width: '10px'
        }, {
          offset: 1,
          opacity: '1',
          width: '20px'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 500
        });
      });
      (0, _qunit.test)('two keyframe motions with 2 frames and 3 frames', function (assert) {
        let keyframeProviderStub1 = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let keyframeProviderStub2 = {
          keyframes: [{
            width: '10px'
          }, {
            width: '35px'
          }, {
            width: '20px'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub1, keyframeProviderStub2]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0',
          width: '10px'
        }, {
          offset: 0.5,
          width: '35px'
        }, {
          offset: 1,
          opacity: '1',
          width: '20px'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 500
        });
      });
      (0, _qunit.test)('two keyframe motions with explicit offset values', function (assert) {
        let keyframeProviderStub1 = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '0',
            offset: 0.8
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let keyframeProviderStub2 = {
          keyframes: [{
            width: '10px'
          }, {
            width: '35px',
            offset: 0.2
          }, {
            width: '20px'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub1, keyframeProviderStub2]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0',
          width: '10px'
        }, {
          offset: 0.2,
          width: '35px'
        }, {
          offset: 0.8,
          opacity: '0'
        }, {
          offset: 1,
          opacity: '1',
          width: '20px'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 500
        });
      });
      (0, _qunit.test)('three keyframe motions with different frame counts', function (assert) {
        let keyframeProviderStub1 = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let keyframeProviderStub2 = {
          keyframes: [{
            width: '10px'
          }, {
            width: '35px'
          }, {
            width: '20px'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let keyframeProviderStub3 = {
          keyframes: [{
            transform: 'translate(0,0)'
          }, {
            transform: 'translate(5,5)'
          }, {
            transform: 'translate(20,0)'
          }, {
            transform: 'translate(20,20)'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub1, keyframeProviderStub2, keyframeProviderStub3]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0',
          width: '10px',
          transform: 'translate(0,0)'
        }, {
          offset: 0.33,
          transform: 'translate(5,5)'
        }, {
          offset: 0.5,
          width: '35px'
        }, {
          offset: 0.67,
          transform: 'translate(20,0)'
        }, {
          offset: 1,
          opacity: '1',
          width: '20px',
          transform: 'translate(20,20)'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 500
        });
      });
      (0, _qunit.test)('two keyframe motions with different durations', function (assert) {
        let keyframeProviderStub1 = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let keyframeProviderStub2 = {
          keyframes: [{
            width: '10px'
          }, {
            width: '35px'
          }, {
            width: '20px'
          }],
          keyframeAnimationOptions: {
            duration: 1000
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub2, keyframeProviderStub1]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0',
          width: '10px'
        }, {
          offset: 0.5,
          opacity: '1',
          width: '35px'
        }, {
          offset: 1,
          opacity: '1',
          width: '20px'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 1000
        });
      });
      (0, _qunit.test)('two keyframe motions with different durations, explicit offsets', function (assert) {
        let keyframeProviderStub1 = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '0.5',
            offset: 0.6
          }, {
            opacity: '0.7',
            offset: 0.8
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            duration: 500
          }
        };
        let keyframeProviderStub2 = {
          keyframes: [{
            width: '10px'
          }, {
            width: '35px',
            offset: 0.4
          }, {
            width: '20px'
          }],
          keyframeAnimationOptions: {
            duration: 1000
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub2, keyframeProviderStub1]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0',
          width: '10px'
        }, {
          offset: 0.3,
          opacity: '0.5'
        }, {
          offset: 0.4,
          width: '35px',
          opacity: '0.7'
        }, {
          offset: 0.5,
          opacity: '1'
        }, {
          offset: 1,
          opacity: '1',
          width: '20px'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 1000
        });
      });
      (0, _qunit.test)('two keyframe motions with delays', function (assert) {
        let keyframeProviderStub1 = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            delay: 200,
            duration: 500
          }
        };
        let keyframeProviderStub2 = {
          keyframes: [{
            width: '10px'
          }, {
            width: '35px'
          }, {
            width: '20px'
          }],
          keyframeAnimationOptions: {
            delay: 100,
            duration: 500
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub1, keyframeProviderStub2]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0',
          width: '10px'
        }, {
          offset: 0.14,
          width: '10px'
        }, {
          offset: 0.29,
          opacity: '0'
        }, {
          offset: 0.5,
          width: '35px'
        }, {
          offset: 0.86,
          width: '20px'
        }, {
          offset: 1,
          opacity: '1',
          width: '20px'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 700
        });
      });
      (0, _qunit.test)('two keyframe motions with delays, explicit offsets', function (assert) {
        let keyframeProviderStub1 = {
          keyframes: [{
            opacity: '0'
          }, {
            opacity: '0.5',
            offset: 0.6
          }, {
            opacity: '0.7',
            offset: 0.8
          }, {
            opacity: '1'
          }],
          keyframeAnimationOptions: {
            delay: 200,
            duration: 500
          }
        };
        let keyframeProviderStub2 = {
          keyframes: [{
            width: '10px'
          }, {
            width: '35px',
            offset: 0.4
          }, {
            width: '20px'
          }],
          keyframeAnimationOptions: {
            delay: 100,
            duration: 500
          }
        };
        let generator = new _keyframeGenerator.default([keyframeProviderStub1, keyframeProviderStub2]);
        assert.deepEqual(generator.keyframes, [{
          offset: 0,
          opacity: '0',
          width: '10px'
        }, {
          offset: 0.14,
          width: '10px'
        }, {
          offset: 0.29,
          opacity: '0'
        }, {
          offset: 0.43,
          width: '35px'
        }, {
          offset: 0.71,
          opacity: '0.5'
        }, {
          offset: 0.86,
          width: '20px',
          opacity: '0.7'
        }, {
          offset: 1,
          opacity: '1',
          width: '20px'
        }]);
        assert.deepEqual(generator.keyframeAnimationOptions, {
          duration: 700
        });
      }); // conflicting easings
    });
  });
});
define("animations/tests/unit/value/index-test", ["qunit", "animations/value/index", "animations/behaviors/linear"], function (_qunit, _index, _linear) {
  "use strict";

  (0, _qunit.module)('Unit | BaseValue | Index', function () {
    (0, _qunit.module)('keyframe generation with linear behavior', function () {
      (0, _qunit.test)('from single keyframe motion with 3 frames', function (assert) {
        let value = new _index.default('opacity', 0);
        assert.deepEqual(value.keyframes, []);
        value.applyBehavior(new _linear.default(), 1, 1);
        assert.deepEqual(value.keyframes, [{
          opacity: 0
        }, {
          opacity: 1
        }]);
        value.applyBehavior(new _linear.default(), 0, 1);
        assert.deepEqual(value.keyframes, [{
          opacity: 1
        }, {
          opacity: 0
        }]);
      });
      (0, _qunit.test)('keyframes are generated at 60 FPS', function (assert) {
        let value = new _index.default('opacity', 0);
        assert.deepEqual(value.keyframes, []);
        value.applyBehavior(new _linear.default(), 1, 100);
        assert.deepEqual(value.keyframes, [{
          opacity: 0
        }, {
          opacity: 0.16666666666666666
        }, {
          opacity: 0.3333333333333333
        }, {
          opacity: 0.5
        }, {
          opacity: 0.6666666666666666
        }, {
          opacity: 0.8333333333333334
        }, {
          opacity: 1
        }]);
      });
      (0, _qunit.test)('interruption based on time is handled', function (assert) {
        let behavior = new _linear.default();
        let value = new _index.default('opacity', 0, {
          transferVelocity: false
        });
        assert.deepEqual(value.keyframes, []);
        value.applyBehavior(behavior, 1, 100);
        assert.deepEqual(value.keyframes, [{
          opacity: 0
        }, {
          opacity: 0.16666666666666666
        }, {
          opacity: 0.3333333333333333
        }, {
          opacity: 0.5
        }, {
          opacity: 0.6666666666666666
        }, {
          opacity: 0.8333333333333334
        }, {
          opacity: 1
        }]);
        value.applyBehavior(behavior, 0.2, 34, 0, 50);
        assert.deepEqual(value.keyframes, [{
          opacity: 0.5
        }, {
          opacity: 0.35
        }, {
          opacity: 0.2
        }]);
      });
      (0, _qunit.test)('keyframe generation with numerical units', function (assert) {
        let value = new _index.default('left', '0px');
        assert.deepEqual(value.keyframes, []);
        value.applyBehavior(new _linear.default(), '100px', 33);
        assert.deepEqual(value.keyframes, [{
          left: '0px'
        }, {
          left: '50px'
        }, {
          left: '100px'
        }]);
      });
      (0, _qunit.test)('keyframe generation with interruption and velocity transfer', function (assert) {
        let value = new _index.default('opacity', 0);
        assert.deepEqual(value.keyframes, []);
        let behavior = new _linear.default();
        value.applyBehavior(behavior, 1, 100);
        assert.deepEqual(value.keyframes, [{
          opacity: 0
        }, {
          opacity: 0.16666666666666666
        }, {
          opacity: 0.3333333333333333
        }, {
          opacity: 0.5
        }, {
          opacity: 0.6666666666666666
        }, {
          opacity: 0.8333333333333334
        }, {
          opacity: 1
        }]);
        value.applyBehavior(behavior, 0, 100, 0, 50);
        assert.deepEqual(value.keyframes, [{
          opacity: 0.5
        }, {
          opacity: 0.5833333333333334
        }, {
          opacity: 0.5000000000000001
        }, {
          opacity: 0.25
        }, {
          opacity: 0.16666666666666669
        }, {
          opacity: 0.08333333333333331
        }, {
          opacity: 0
        }]);
      });
    });
  });
});
define('animations/config/environment', [], function() {
  var prefix = 'animations';
try {
  var metaName = prefix + '/config/environment';
  var rawConfig = document.querySelector('meta[name="' + metaName + '"]').getAttribute('content');
  var config = JSON.parse(decodeURIComponent(rawConfig));

  var exports = { 'default': config };

  Object.defineProperty(exports, '__esModule', { value: true });

  return exports;
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

});

require('animations/tests/test-helper');
EmberENV.TESTS_FILE_LOADED = true;
//# sourceMappingURL=tests.map
