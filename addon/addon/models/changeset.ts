import Sprite, { SpriteType } from './sprite';
import AnimationContext from '../components/animation-context';
import { assert } from '@ember/debug';

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

  addSprites(sprites: Sprite[]) {
    for (let sprite of sprites) {
      if (sprite.type === SpriteType.Kept) {
        this.keptSprites.add(sprite);
      } else if (sprite.type === SpriteType.Inserted) {
        this.insertedSprites.add(sprite);
      } else if (sprite.type === SpriteType.Removed) {
        this.removedSprites.add(sprite);
      }
    }
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
    return [...set][0] ?? null;
  }

  /*
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
  }*/
}
