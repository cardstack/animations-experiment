/* eslint-disable @typescript-eslint/no-non-null-assertion */
import Sprite from '@cardstack/boxel-motion/models/sprite';
import { CopiedCSS } from '@cardstack/boxel-motion/utils/measurement';
import SpriteTree, {
  IContext,
  ISpriteModifier,
  SpriteTreeNode,
} from '@cardstack/boxel-motion/models/sprite-tree';
import { module, test } from 'qunit';

class MockAnimationContext implements IContext {
  id: string | undefined;
  element: HTMLElement;
  isAnimationContext = true;
  constructor(
    parentEl: HTMLElement | null = null,
    id: string | undefined = undefined,
    element: HTMLElement | null = null
  ) {
    this.element = element ?? document.createElement('div');
    if (parentEl) {
      parentEl.appendChild(this.element);
    }
    this.id = id;
  }
  orphans: Map<string, HTMLElement> = new Map();
  currentBounds?: DOMRect | undefined;
  lastBounds?: DOMRect | undefined;
  isInitialRenderCompleted = false;
  isStable = false;
  args = {};

  captureSnapshot(
    opts?: { withAnimations: boolean; playAnimations: boolean } | undefined
  ): void {
    throw new Error('Method not implemented.');
  }
  shouldAnimate(): boolean {
    throw new Error('Method not implemented.');
  }
  hasOrphan(sprite: Sprite): boolean {
    throw new Error('Method not implemented.');
  }
  removeOrphan(sprite: Sprite): void {
    throw new Error('Method not implemented.');
  }
  appendOrphan(sprite: Sprite): void {
    throw new Error('Method not implemented.');
  }
  clearOrphans(): void {
    throw new Error('Method not implemented.');
  }
}

class MockSpriteModifier implements ISpriteModifier {
  element: HTMLElement;
  id: string;
  constructor(
    parentEl: HTMLElement | null = null,
    id = 'Mock',
    element: HTMLElement | null = null
  ) {
    this.element = element ?? document.createElement('div');
    this.id = id;
    if (parentEl) {
      parentEl.appendChild(this.element);
    }
  }
  role: string | null = null;
  currentBounds?: DOMRect | undefined;
  lastBounds?: DOMRect | undefined;
  captureSnapshot(
    opts?: { withAnimations: boolean; playAnimations: boolean } | undefined
  ): void {
    throw new Error('Method not implemented.');
  }
  lastComputedStyle: CopiedCSS | undefined;
  currentComputedStyle: CopiedCSS | undefined;
}

module('Unit | Models | SpriteTree', function (hooks) {
  let subject: SpriteTree;
  hooks.beforeEach(function () {
    subject = new SpriteTree();
  });
  module('empty', function () {
    test('constructing an empty tree', function (assert) {
      assert.ok(subject);
      assert.equal(
        subject.rootNodes.size,
        0,
        'tree has no rootNodes initially'
      );
    });
    test('adding a root animation context node', function (assert) {
      let context = new MockAnimationContext();
      let node = subject.addAnimationContext(context);
      assert.ok(node, 'addAnimationContext returns a node');
      assert.equal(
        node,
        subject.lookupNode(context.element),
        'can lookup node after adding it'
      );
      assert.equal(node.isRoot, true, 'context node with none above it isRoot');
      assert.equal(node.children.size, 0, 'context node has no children yet');
      assert.equal(subject.rootNodes.size, 1, 'tree has one rootNode');
      assert.equal(
        Array.from(subject.rootNodes)[0],
        node,
        'tree has context node has root node'
      );
    });
    test('adding a sprite modifier and then its parent animation context node', function (assert) {
      let context = new MockAnimationContext();
      let spriteModifier = new MockSpriteModifier(context.element);
      let spriteModifierNode = subject.addSpriteModifier(spriteModifier);
      let contextNode = subject.addAnimationContext(context);
      assert.equal(
        contextNode.isRoot,
        true,
        'context node with none above it isRoot'
      );
      assert.equal(
        spriteModifierNode.isRoot,
        false,
        'spriteModifier node under context is not isRoot'
      );
      assert.equal(
        spriteModifierNode.children.size,
        0,
        'spriteModifierNode node has no children yet'
      );
      assert.equal(
        contextNode.children.size,
        1,
        'context node has one childNode'
      );
      assert.equal(subject.rootNodes.size, 1, 'tree has one rootNode');
      assert.equal(
        Array.from(subject.rootNodes)[0],
        contextNode,
        'tree has context node as root node'
      );
      assert.equal(
        Array.from(contextNode.children)[0],
        spriteModifierNode,
        'context node has one has sprite node as child'
      );
    });
  });
  module('with a context node', function (hooks) {
    let context: MockAnimationContext, contextNode: SpriteTreeNode;
    hooks.beforeEach(function () {
      context = new MockAnimationContext();
      contextNode = subject.addAnimationContext(context);
    });
    test('adding a sprite modifier directly under context', function (assert) {
      let spriteModifer = new MockSpriteModifier(context.element);
      let spriteNode = subject.addSpriteModifier(spriteModifer);
      assert.ok(spriteNode, 'addSpriteModifier returns a node');
      assert.equal(
        spriteNode,
        subject.lookupNode(spriteModifer.element),
        'can lookup node after adding it'
      );
      assert.equal(
        spriteNode.isRoot,
        false,
        'sprite node nested under a context has isRoot false'
      );
      assert.equal(
        spriteNode.parent,
        contextNode,
        'sprite node has its parent set correctly'
      );
      assert.equal(
        contextNode.children.size,
        1,
        'context node has one childNode'
      );
      assert.equal(
        Array.from(contextNode.children)[0],
        spriteNode,
        'context node has sprite node as child'
      );
    });
    test('adding a sprite modifier under context with other elements in between', function (assert) {
      let context = new MockAnimationContext();
      let contextNode = subject.addAnimationContext(context);
      let elementBetweenContextAndSprite = document.createElement('div');
      context.element.appendChild(elementBetweenContextAndSprite);
      let elementBetweenContextAndSprite2 = document.createElement('div');
      elementBetweenContextAndSprite.appendChild(
        elementBetweenContextAndSprite2
      );
      let spriteModifer = new MockSpriteModifier(
        elementBetweenContextAndSprite2
      );
      let spriteNode = subject.addSpriteModifier(spriteModifer);
      assert.ok(spriteNode, 'addSpriteModifier returns a node');
      assert.equal(
        spriteNode,
        subject.lookupNode(spriteModifer.element),
        'can lookup node after adding it'
      );
      assert.equal(
        spriteNode.isRoot,
        false,
        'sprite node nested under a context has isRoot false'
      );
      assert.equal(
        spriteNode.parent,
        contextNode,
        'sprite node has its parent set correctly'
      );
    });
    test('adding a context nested under another context', function (assert) {
      let nestedContext = new MockAnimationContext(context.element);
      let nestedContextNode = subject.addAnimationContext(nestedContext);
      assert.equal(
        nestedContextNode.isRoot,
        false,
        'context node nested under a context has isRoot false'
      );
      assert.equal(
        nestedContextNode.parent,
        contextNode,
        'nested context node has its parent set correctly'
      );
    });
    test('remove an animation context', function (assert) {
      subject.removeAnimationContext(context);
      assert.equal(
        subject.lookupNode(context.element),
        null,
        'can no longer lookup node after removing it'
      );
      assert.equal(subject.rootNodes.size, 0, 'tree has no rootNodes left');
    });
    test('getting a context run list', function (assert) {
      assert.deepEqual(subject.getContextRunList(new Set([context])), [
        context,
      ]);
    });
  });
  module('with a context node and nested sprite modifier', function (hooks) {
    let context: MockAnimationContext,
      contextNode: SpriteTreeNode,
      spriteModifer: MockSpriteModifier,
      spriteNode: SpriteTreeNode;
    hooks.beforeEach(function () {
      context = new MockAnimationContext();
      contextNode = subject.addAnimationContext(context);
      spriteModifer = new MockSpriteModifier(context.element);
      spriteNode = subject.addSpriteModifier(spriteModifer);
    });
    test('adding a sprite modifier under another sprite modifier', function (assert) {
      let nestedSpriteModifer = new MockSpriteModifier(spriteModifer.element);
      let nestedSpriteNode = subject.addSpriteModifier(nestedSpriteModifer);
      assert.equal(
        nestedSpriteNode.isRoot,
        false,
        'sprite node nested under a sprite has isRoot false'
      );
      assert.equal(
        nestedSpriteNode.parent,
        spriteNode,
        'nested sprite node has its parent set correctly'
      );
      let descendants = subject.descendantsOf(context);
      assert.equal(descendants.length, 2, 'the context has two descendants');
      assert.equal(
        descendants[0],
        spriteModifer,
        'the first descendant is the spriteModifier'
      );
      assert.equal(
        descendants[1],
        nestedSpriteModifer,
        'the second descendant is the nested spriteModifier'
      );
    });

    test('remove a sprite modifier', function (assert) {
      subject.removeSpriteModifier(spriteModifer);
      assert.equal(
        subject.lookupNode(spriteModifer.element),
        spriteNode,
        'can still lookup sprite node after removing it'
      );
      assert.equal(
        contextNode.children.size,
        0,
        'context node has no children yet'
      );
      assert.equal(
        contextNode.freshlyRemovedChildren.size,
        1,
        'context node has a single node in its freshlyRemovedChildren'
      );
      assert.equal(
        Array.from(contextNode.freshlyRemovedChildren)[0],
        spriteNode,
        'context node has removed spriteNode in freshlyRemovedChildren'
      );
      let descendants = subject.descendantsOf(context);
      assert.equal(descendants.length, 0, 'the context has no descendants');
      let descendantsWithFreshRemovals = subject.descendantsOf(context, {
        includeFreshlyRemoved: true,
      });
      assert.equal(
        descendantsWithFreshRemovals.length,
        1,
        'descendants includes freshly removed when flag is passed'
      );
      assert.equal(
        descendantsWithFreshRemovals[0],
        spriteModifer,
        'the returned descendant is the removed spriteModifier'
      );
    });
  });
  module('with two context nodes, each with a sprite', function (hooks) {
    let context1: IContext,
      context2: IContext,
      sprite1: ISpriteModifier,
      sprite2: ISpriteModifier;
    hooks.beforeEach(function () {
      context1 = new MockAnimationContext();
      context2 = new MockAnimationContext();
      sprite1 = new MockSpriteModifier(context1.element as HTMLElement);
      sprite2 = new MockSpriteModifier(context2.element as HTMLElement);
      subject.addAnimationContext(context1);
      subject.addAnimationContext(context2);
      subject.addSpriteModifier(sprite1);
      subject.addSpriteModifier(sprite2);
    });

    test('getting a context run list', function (assert) {
      assert.deepEqual(subject.getContextRunList(new Set([context1])), [
        context1,
      ]);
      assert.deepEqual(subject.getContextRunList(new Set([context2])), [
        context2,
      ]);
      assert.deepEqual(
        subject.getContextRunList(new Set([context1, context2])),
        [context1, context2]
      );
    });
  });
  module(
    'with a sprite modifier nested under another sprite modifier',
    function (hooks) {
      let context: MockAnimationContext,
        spriteModifer: MockSpriteModifier,
        spriteNode: SpriteTreeNode,
        nestedSpriteModifer: MockSpriteModifier,
        nestedSpriteNode: SpriteTreeNode;
      hooks.beforeEach(function () {
        context = new MockAnimationContext();
        subject.addAnimationContext(context);
        spriteModifer = new MockSpriteModifier(context.element);
        spriteNode = subject.addSpriteModifier(spriteModifer);
        nestedSpriteModifer = new MockSpriteModifier(spriteModifer.element);
        nestedSpriteNode = subject.addSpriteModifier(nestedSpriteModifer);
      });
      test('removing nested modifiers results in both being freshlyRemoved', function (assert) {
        let otherContext = new MockAnimationContext();
        subject.addAnimationContext(otherContext);
        subject.removeSpriteModifier(nestedSpriteModifer);
        subject.removeSpriteModifier(spriteModifer);
        assert.equal(
          nestedSpriteNode.parent,
          spriteNode,
          'nested sprite node has its parent set correctly'
        );
      });
    }
  );
  module('with two contexts nested under another context', function (hooks) {
    let parentContext: MockAnimationContext,
      childContext1: MockAnimationContext,
      childContext2: MockAnimationContext;
    hooks.beforeEach(function () {
      parentContext = new MockAnimationContext(null, 'parentContext');
      subject.addAnimationContext(parentContext);
      childContext1 = new MockAnimationContext(
        parentContext.element,
        'childContext1'
      );
      subject.addAnimationContext(childContext1);
      childContext2 = new MockAnimationContext(
        parentContext.element,
        'childContext2'
      );
      subject.addAnimationContext(childContext2);
    });
    test('getting a context run list', function (assert) {
      assert.deepEqual(
        subject.getContextRunList(new Set([parentContext])),
        [parentContext],
        'run list for the parent context just includes the parent context'
      );
      assert.deepEqual(
        subject.getContextRunList(new Set([parentContext, childContext1])),
        [childContext1, parentContext],
        'when both parent and child are specified both are returned, with child first'
      );
      assert.deepEqual(
        subject.getContextRunList(new Set([childContext1])),
        [childContext1, parentContext],
        'when a child is specified, the run list includes the child then the parent'
      );
      let runList = subject.getContextRunList(
        new Set([childContext1, childContext2])
      );
      assert.ok(
        runList[0] === childContext1 || runList[0] === childContext2,
        'when two children are specified, the parent is included once, after the children'
      );
      assert.ok(
        runList[1] === childContext1 || runList[1] === childContext2,
        'when two children are specified, the parent is included once, after the children'
      );
      assert.equal(
        runList[2],
        parentContext,
        'when two children are specified, the parent is included once, after the children'
      );
      assert.deepEqual(
        subject.getContextRunList(new Set([childContext2])),
        [childContext2, parentContext],
        'when a child is specified, the run list includes the child then the parent'
      );
    });
  });
  module(
    'with two nested contexts of which one is also a sprite',
    function (hooks) {
      let parentContext: MockAnimationContext,
        childContext: MockAnimationContext;
      let contextSpriteModifier: MockSpriteModifier,
        leafSpriteModifier: MockSpriteModifier;

      hooks.beforeEach(function () {
        /*
          The structure looks like:
          - parentContext
            - childContext / contextSpriteModifier
              - leafSpriteModifier
         */
        parentContext = new MockAnimationContext(null, 'parentContext');
        subject.addAnimationContext(parentContext);
        childContext = new MockAnimationContext(
          parentContext.element,
          'childContext'
        );
        subject.addAnimationContext(childContext);

        contextSpriteModifier = new MockSpriteModifier(
          parentContext.element,
          'ContextAsSprite',
          childContext.element
        );
        subject.addSpriteModifier(contextSpriteModifier);

        leafSpriteModifier = new MockSpriteModifier(
          childContext.element,
          'LeafSprite'
        );
        subject.addSpriteModifier(leafSpriteModifier);
      });
      test('nodes are correctly added and typed', function (assert) {
        let childNode = subject.lookupNode(
          childContext.element
        ) as SpriteTreeNode;

        assert.ok(childNode, 'child node exists');
        assert.strictEqual(childNode.isContext(), true, 'node is context');
        assert.strictEqual(childNode.isSprite(), true, 'node is sprite');
        assert.strictEqual(
          childNode.children.size,
          1,
          'context node has a single child'
        );

        let leafSprites = [...childNode.children];
        assert.strictEqual(
          leafSprites.length,
          1,
          'childContext node has a single child'
        );

        let leafSprite = leafSprites[0] as SpriteTreeNode;
        assert.ok(leafSprite.isSprite());
        assert.notOk(leafSprite.isContext());
        assert.strictEqual(leafSprite.spriteModel, leafSpriteModifier);
      });
      test('getting descendants', function (assert) {
        let parentContextDescendants = subject.descendantsOf(parentContext);
        assert.deepEqual(
          parentContextDescendants,
          [childContext, contextSpriteModifier, leafSpriteModifier],
          'includes childContext as AnimationContext instance, childContext as SpriteModifier instance, and leafSprite as SpriteModifier instance'
        );

        let childContextDescendants = subject.descendantsOf(childContext);
        assert.deepEqual(
          childContextDescendants,
          [leafSpriteModifier],
          'includes leafSprite as SpriteModifier instance'
        );
      });
      test('getting a context run list', function (assert) {
        assert.deepEqual(
          subject.getContextRunList(new Set([parentContext])),
          [parentContext],
          'run list for the parent context just includes the parent context'
        );
        assert.deepEqual(
          subject.getContextRunList(new Set([parentContext, childContext])),
          [childContext, parentContext],
          'when both parent and child are specified both are returned, with child first'
        );
        assert.deepEqual(
          subject.getContextRunList(new Set([childContext])),
          [childContext, parentContext],
          'when a child is specified, the run list includes the child then the parent'
        );
      });
    }
  );

  module('insertion follows dom hierarchy', function (hooks) {
    let models = {} as {
      parentContext: MockAnimationContext;
      childContext: MockAnimationContext;
      childSprite: MockSpriteModifier;
      grandchildSprite: MockSpriteModifier;
      grandchildContext: MockAnimationContext;
    };
    let divs = {} as {
      parentContext: HTMLElement;
      childContext: HTMLElement;
      grandchildSprite: HTMLElement;
      childSprite: HTMLElement;
      grandchildContext: HTMLElement;
    };

    hooks.beforeEach(function () {
      divs = {
        parentContext: document.createElement('div'),
        childContext: document.createElement('div'),
        grandchildSprite: document.createElement('div'),
        childSprite: document.createElement('div'),
        grandchildContext: document.createElement('div'),
      };

      models.parentContext = new MockAnimationContext(
        null,
        'parent-context',
        divs.parentContext
      );
      models.childContext = new MockAnimationContext(
        divs.parentContext,
        'child-context',
        divs.childContext
      );
      models.childSprite = new MockSpriteModifier(
        divs.parentContext,
        'child-sprite',
        divs.childSprite
      );
      models.grandchildSprite = new MockSpriteModifier(
        divs.childContext,
        'grandchild-sprite',
        divs.grandchildSprite
      );
      models.grandchildContext = new MockAnimationContext(
        divs.childSprite,
        'grandchild-context',
        divs.grandchildContext
      );
    });

    test('it holds inserted nodes in an array to be sorted prior to insertion', async function (assert) {
      assert.equal(subject._pendingAdditions.length, 0);

      subject.addPendingAnimationContext(models.grandchildContext);
      subject.addPendingSpriteModifier(models.childSprite);
      subject.addPendingAnimationContext(models.parentContext);

      assert.equal(subject._pendingAdditions.length, 3);

      subject.flushPendingAdditions();

      assert.equal(subject._pendingAdditions.length, 0);
    });

    test('it can ensure that nodes have the correct hierarchy', async function (assert) {
      // insert out of order

      subject.addPendingAnimationContext(models.grandchildContext);
      subject.addPendingSpriteModifier(models.childSprite);
      subject.addPendingAnimationContext(models.parentContext);
      subject.flushPendingAdditions();

      let rootNodes = [...subject.rootNodes];
      assert.equal(rootNodes.length, 1);

      let rootNode = rootNodes[0]!;
      assert.ok(
        rootNode.isContext() &&
          !rootNode.isSprite() &&
          rootNode.contextModel.id === 'parent-context',
        'The root node is the parent context'
      );
      assert.equal(rootNode.children.size, 1);

      let children = [...rootNode.children];

      let childSpriteNode = children.find(
        (v) => (v.spriteModel as MockSpriteModifier)?.id === 'child-sprite'
      )!;
      assert.ok(
        !childSpriteNode.isContext(),
        'The child sprite node is correct'
      );
      assert.equal(childSpriteNode.children.size, 1);
      let grandchildContextNode = [...childSpriteNode.children][0]!;
      assert.ok(
        grandchildContextNode.isContext() &&
          !grandchildContextNode.isSprite() &&
          grandchildContextNode.contextModel.id === 'grandchild-context',
        'The grandchild context node is correct'
      );
    });

    test('inserting a second time still keeps the correct node hierarchy', async function (assert) {
      subject.addPendingAnimationContext(models.grandchildContext);
      subject.addPendingSpriteModifier(models.childSprite);
      subject.addPendingAnimationContext(models.parentContext);
      subject.flushPendingAdditions();

      // insert in order
      subject.addPendingAnimationContext(models.childContext);
      subject.addPendingSpriteModifier(models.grandchildSprite);
      subject.flushPendingAdditions();

      let rootNodes = [...subject.rootNodes];
      assert.equal(rootNodes.length, 1);

      let rootNode = rootNodes[0]!;
      assert.ok(
        rootNode.isContext() &&
          !rootNode.isSprite() &&
          rootNode.contextModel.id === 'parent-context',
        'The root node is the parent context'
      );
      assert.equal(rootNode.children.size, 2);

      let children = [...rootNode.children];

      let childSpriteNode = children.find(
        (v) => (v.spriteModel as MockSpriteModifier)?.id === 'child-sprite'
      )!;
      assert.ok(
        !childSpriteNode.isContext(),
        'The child sprite node is correct'
      );
      assert.equal(childSpriteNode.children.size, 1);
      let grandchildContextNode = [...childSpriteNode.children][0]!;
      assert.ok(
        grandchildContextNode.isContext() &&
          !grandchildContextNode.isSprite() &&
          grandchildContextNode.contextModel.id === 'grandchild-context',
        'The grandchild context node is correct'
      );

      let childContextNode = children.find(
        (v) => (v.contextModel as MockAnimationContext)?.id === 'child-context'
      )!;
      assert.ok(
        !childContextNode.isSprite(),
        'The child context node is correct'
      );
      assert.equal(childContextNode.children.size, 1);
      let grandchildSpriteNode = [...childContextNode.children][0]!;
      assert.ok(
        grandchildSpriteNode.isSprite() &&
          !grandchildSpriteNode.isContext() &&
          grandchildSpriteNode.spriteModel.id === 'grandchild-sprite',
        'The grandchild sprite node is correct'
      );
    });
  });
});
