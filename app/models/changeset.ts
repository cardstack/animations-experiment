import SpriteFactory from './sprite-factory';
import Sprite, { SpriteIdentifier, SpriteType } from './sprite';
import AnimationContext from '../components/animation-context';
import SpriteModifier from '../modifiers/sprite';
import { assert } from '@ember/debug';
import ContextAwareBounds from 'animations/models/context-aware-bounds';

export type SpritesForArgs = {
  type?: SpriteType | undefined;
  role?: string | undefined;
  id?: string | undefined;
};

function union<T>(...sets: Set<T>[]): Set<T> {
  switch (sets.length) {
    case 0:
      return new Set();
    case 1:
      return new Set(sets[0]);
    default:
      // eslint-disable-next-line no-case-declarations
      let result = new Set<T>();
      for (let set of sets) {
        for (let item of set) {
          result.add(item);
        }
      }
      return result;
  }
}

export default class Changeset {
  context: AnimationContext;
  intent: string | undefined;
  insertedSprites: Set<Sprite> = new Set();
  removedSprites: Set<Sprite> = new Set();
  keptSprites: Set<Sprite> = new Set();

  constructor(animationContext: AnimationContext, intent: string | undefined) {
    this.context = animationContext;
    this.intent = intent;
  }

  spritesFor(criteria: SpritesForArgs): Set<Sprite> {
    assert(
      'expect spritesFor to be called with some criteria',
      criteria.type || criteria.role || criteria.id
    );
    let result;
    if (criteria.type) {
      switch (criteria.type) {
        case SpriteType.Inserted:
          result = new Set(this.insertedSprites);
          break;
        case SpriteType.Removed:
          result = new Set(this.removedSprites);
          break;
        case SpriteType.Kept:
          result = new Set(this.keptSprites);
          break;
      }
    }
    result =
      result ||
      union(this.keptSprites, this.insertedSprites, this.removedSprites);

    if (criteria.id) {
      for (let sprite of result) {
        if (sprite.id !== criteria.id) {
          result.delete(sprite);
        }
      }
    }
    if (criteria.role) {
      for (let sprite of result) {
        if (sprite.role !== criteria.role) {
          result.delete(sprite);
        }
      }
    }

    return result;
  }

  spriteFor(criteria: SpritesForArgs): Sprite | null {
    let set = this.spritesFor(criteria);
    if (set.size > 1) {
      throw new Error(
        `More than one sprite found matching criteria ${criteria}`
      );
    }
    if (set.size === 0) {
      return null;
    }
    return [...set][0];
  }

  addInsertedSprites(freshlyAdded: Set<SpriteModifier>): void {
    assert(
      'freshlyAdded sprites should not have identifier collisions with current inserted sprites',
      [...freshlyAdded].every((sprite) =>
        [...this.insertedSprites].every(
          (s2) =>
            !new SpriteIdentifier(sprite.id, sprite.role).equals(s2.identifier)
        )
      )
    );
    for (let spriteModifier of freshlyAdded) {
      this.insertedSprites.add(
        SpriteFactory.createInsertedSprite(spriteModifier, this.context)
      );
    }
  }

  addRemovedSprites(freshlyRemoved: Set<SpriteModifier>): void {
    assert(
      'freshlyRemoved sprites should not have identifier collisions with current removed sprites',
      [...freshlyRemoved].every((sprite) =>
        [...this.removedSprites].every(
          (s2) =>
            !new SpriteIdentifier(sprite.id, sprite.role).equals(s2.identifier)
        )
      )
    );
    for (let spriteModifier of freshlyRemoved) {
      this.removedSprites.add(
        SpriteFactory.createRemovedSprite(spriteModifier, this.context)
      );
    }
  }

  addKeptSprites(freshlyChanged: Set<SpriteModifier>): void {
    assert(
      'freshlyChanged sprites should not have identifier collisions with current kept sprites',
      [...freshlyChanged].every((sprite) =>
        [...this.keptSprites].every(
          (s2) =>
            !new SpriteIdentifier(sprite.id, sprite.role).equals(s2.identifier)
        )
      )
    );
    for (let spriteModifier of freshlyChanged) {
      this.keptSprites.add(
        SpriteFactory.createKeptSprite(spriteModifier, this.context)
      );
    }
  }

  finalizeSpriteCategories(): void {
    let insertedSpritesArr = [...this.insertedSprites];
    let removedSpritesArr = [...this.removedSprites];
    let insertedIds = insertedSpritesArr.map((s) => s.identifier);
    let removedIds = removedSpritesArr.map((s) => s.identifier);
    let intersectingIds = insertedIds.filter(
      (identifier) => !!removedIds.find((o) => o.equals(identifier))
    );
    for (let intersectingId of intersectingIds) {
      let removedSprites = removedSpritesArr.filter((s) =>
        s.identifier.equals(intersectingId)
      );
      let insertedSprite = insertedSpritesArr.find((s) =>
        s.identifier.equals(intersectingId)
      );
      if (!insertedSprite || removedSprites.length === 0) {
        throw new Error(
          'intersection check should always result in removedSprite and insertedSprite being found'
        );
      }
      this.insertedSprites.delete(insertedSprite);

      // TODO: verify if this is correct, we might need to handle it on a different level.
      //  We only get multiple ones in case of an interruption.
      assert(
        'Multiple matching removedSprites found',
        removedSprites.length < 2
      );
      let removedSprite = removedSprites[0];
      if (this.context.hasOrphan(removedSprite.element)) {
        this.context.removeOrphan(removedSprite.element);
      }
      assert(
        'removed sprite changing into kept sprite should not have identifier collisions with current kept sprites',
        [...this.keptSprites].every(
          (s2) => !removedSprite.identifier.equals(s2.identifier)
        )
      );
      this.removedSprites.delete(removedSprite);

      insertedSprite.type = SpriteType.Kept;
      insertedSprite.initialBounds = removedSprite.initialBounds;
      insertedSprite.initialComputedStyle = removedSprite.initialComputedStyle;
      removedSprite.finalBounds = insertedSprite.finalBounds;
      removedSprite.finalComputedStyle = insertedSprite.finalComputedStyle;
      insertedSprite.counterpart = removedSprite;
      this.keptSprites.add(insertedSprite);
    }
  }

  addIntermediateSprites(
    intermediateSprites: Set<Sprite>,
    runningAnimations: Map<string, Set<Animation>>
  ): {
    playUnrelatedAnimations: () => void;
    cancelInterruptedAnimations: () => void;
  } {
    let allSprites = [
      ...this.insertedSprites,
      ...this.removedSprites,
      ...this.keptSprites,
    ];

    let allInterruptedSprites: Set<Sprite> = new Set();

    if (intermediateSprites.size) {
      for (let sprite of allSprites) {
        let interruptedSprites = [...intermediateSprites].filter((is) => {
          if (is.identifier.equals(sprite.identifier)) {
            allInterruptedSprites.add(sprite);
            return true;
          } else {
            return false;
          }
        });

        // If more than 1 matching IntermediateSprite is found, we warn but also guess the last one is correct
        if (interruptedSprites.length > 1) {
          console.warn(
            `${interruptedSprites.length} matching interruptedSprites found where 1 was expected`,
            interruptedSprites
          );
        }

        let interruptedSprite =
          interruptedSprites[interruptedSprites.length - 1];

        // TODO: we might need to set the bounds on the counterpart of
        //  keptSprites only, not magically modify them for "new" sprites.

        if (interruptedSprite) {
          // TODO: fix this
          if (!interruptedSprite.initialBounds) {
            assert('interruptedSprite should always have initialBounds');
          }

          if (sprite.counterpart) {
            assert(
              'sprite counterpart should always have initialBounds',
              sprite.counterpart?.initialBounds
            );

            // set the interrupted state as the initial state of the counterpart
            sprite.counterpart.initialBounds = new ContextAwareBounds({
              element: interruptedSprite.initialBounds.element,
              contextElement: sprite.counterpart.initialBounds.parent,
            });
            sprite.initialComputedStyle =
              interruptedSprite.initialComputedStyle;
          } else {
            // TODO: check if we want to support this in this way as this case may only happen if the final state is the same as before the interruption.
            // If we have an inserted sprite with a matching intermediate sprite we are animating the same SpriteModifier
            //  This makes it a KeptSprite without a counterpart.
            if (sprite.type === SpriteType.Inserted) {
              sprite.type = SpriteType.Kept;
              this.insertedSprites.delete(sprite);
              this.keptSprites.add(sprite);
            }

            sprite.initialBounds = interruptedSprite.initialBounds;
            sprite.initialComputedStyle =
              interruptedSprite.initialComputedStyle;
          }
        }
      }
    }

    let animationsToPlay: Set<Animation> = new Set();
    let animationsToCancel: Set<Animation> = new Set();

    // Play animations for non-interrupted sprites as we shouldn't have handled them
    for (let sprite of allSprites) {
      let identifierString = sprite.identifier.toString();
      if (
        runningAnimations.has(identifierString) &&
        !allInterruptedSprites.has(sprite)
      ) {
        console.warn(
          `Keeping animations for sprite because sprite was not interrupted`,
          sprite.identifier,
          sprite.type
        );
        runningAnimations
          .get(identifierString)
          ?.forEach((a) => animationsToPlay.add(a));
      } else if (allInterruptedSprites.has(sprite)) {
        runningAnimations
          .get(identifierString)
          ?.forEach((a) => animationsToCancel.add(a));
      }
    }

    // return a function that cancels all animations at once
    return {
      playUnrelatedAnimations: () => {
        animationsToPlay.forEach((a) => a.play());
      },
      cancelInterruptedAnimations: () => {
        animationsToCancel.forEach((a) => a.cancel());
      },
    };
  }
}
