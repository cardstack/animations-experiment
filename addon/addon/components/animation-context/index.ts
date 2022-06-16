import Component from '@glimmer/component';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Ember from 'ember';
import { reads } from 'macro-decorators';
import Changeset from 'animations-experiment/models/changeset';
import Sprite from 'animations-experiment/models/sprite';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import AnimationsService from 'animations-experiment/services/animations';
import { assert } from '@ember/debug';
import { getDocumentPosition } from 'animations-experiment/utils/measurement';

const { VOLATILE_TAG, consumeTag } =
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  Ember.__loader.require('@glimmer/validator');

interface AnimationContextArgs {
  id: string | undefined;
  use: ((changeset: Changeset) => Promise<void>) | undefined;
}

export default class AnimationContextComponent extends Component<AnimationContextArgs> {
  @service declare animations: AnimationsService;
  @reads('args.id') id: string | undefined;

  element!: HTMLElement; //set by template
  orphansElement: HTMLElement | null = null; //set by template
  lastBounds: DOMRect | undefined;
  currentBounds: DOMRect | undefined;
  isInitialRenderCompleted = false;

  get isStable() {
    return (
      this.isInitialRenderCompleted && !this.isDestroying && !this.isDestroyed
    );
  }

  willDestroy(): void {
    super.willDestroy();
    this.animations.unregisterContext(this);
  }

  get renderDetector(): undefined {
    consumeTag(VOLATILE_TAG);
    this.animations.notifyContextRendering(this);
    return undefined;
  }

  @action didInsertEl(element: HTMLElement): void {
    this.element = element;
    this.animations.registerContext(this);
    this.captureSnapshot();
  }

  @action didInsertOrphansEl(element: HTMLElement): void {
    this.orphansElement = element;
  }

  captureSnapshot(): void {
    let { element } = this;
    assert(
      'animation context must be an HTML element',
      element instanceof HTMLElement
    );
    this.lastBounds = this.currentBounds;
    this.currentBounds = getDocumentPosition(element);
  }

  shouldAnimate(changeset: Changeset): boolean {
    return !!(changeset && this.args.use && this.isInitialRenderCompleted);
  }

  hasOrphan(spriteOrElement: Sprite | HTMLElement): boolean {
    let { orphansElement } = this;
    if (spriteOrElement instanceof Sprite) {
      return spriteOrElement.element.parentElement === orphansElement;
    } else {
      return spriteOrElement.parentElement === orphansElement;
    }
  }

  appendOrphan(spriteOrElement: Sprite | HTMLElement): void {
    let { orphansElement } = this;
    if (spriteOrElement instanceof Sprite) {
      orphansElement?.appendChild(spriteOrElement.element);
    } else {
      orphansElement?.appendChild(spriteOrElement);
    }
  }

  removeOrphan(spriteOrElement: Sprite | HTMLElement): void {
    let { orphansElement } = this;
    if (spriteOrElement instanceof Sprite) {
      orphansElement?.removeChild(spriteOrElement.element);
    } else {
      orphansElement?.removeChild(spriteOrElement);
    }
  }

  clearOrphans(): void {
    let { orphansElement } = this;
    while (orphansElement?.firstChild) {
      orphansElement.removeChild(orphansElement.firstChild);
    }
  }
}
