import { on } from '@ember/modifier';
import { action } from '@ember/object';
import { getOwner } from '@ember/owner';
import type { MiddlewareState } from '@floating-ui/dom';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { Velcro } from 'ember-velcro';

interface Signature {
  Args: {
    offset?: number;
    placement?: MiddlewareState['placement'];
  };
  Blocks: {
    content: [];
    trigger: [];
  };
  Element: HTMLElement;
}
export default class Tooltip extends Component<Signature> {
  @tracked isHoverOnTrigger = false;

  get tooltipOverlay() {
    // @ts-expect-error rootElement is present but not in the type
    let applicationElement = getOwner(this)?.rootElement ?? document.body;
    let container = document.querySelector('#tooltip-overlay') as HTMLElement;

    if (!container) {
      container = document.createElement('div');
      container.id = 'tooltip-overlay';
      document.querySelector(applicationElement).appendChild(container);
    }

    return container;
  }

  @action
  onMouseEnter() {
    this.isHoverOnTrigger = true;
  }

  @action
  onMouseLeave() {
    this.isHoverOnTrigger = false;
  }

  <template>
    <Velcro
      @placement={{if @placement @placement 'top'}}
      @offsetOptions={{if @offset @offset 6}}
      as |velcro|
    >
      <div
        class='trigger'
        {{! @glint-ignore velcro.hook }}
        {{velcro.hook}}
        {{on 'mouseenter' this.onMouseEnter}}
        {{on 'mouseleave' this.onMouseLeave}}
        ...attributes
      >
        {{yield to='trigger'}}
      </div>
      {{#if this.isHoverOnTrigger}}
        {{#in-element this.tooltipOverlay}}
          {{! @glint-ignore velcro.loop }}
          <div class='tooltip' {{velcro.loop}} data-test-tooltip-content>
            {{yield to='content'}}
          </div>
        {{/in-element}}
      {{/if}}
    </Velcro>

    <style scoped>
      .trigger {
        width: max-content;
      }

      .tooltip {
        background-color: rgb(0 0 0 / 80%);
        box-shadow: 0 0 0 1px var(--boxel-light-500);
        color: var(--boxel-light);
        text-align: center;
        border-radius: var(--boxel-border-radius-sm);
        padding: var(--boxel-sp-xxxs) var(--boxel-sp-sm);
        width: max-content;
        position: absolute;
        font: var(--boxel-tooltip-font, var(--boxel-font-xs));
        z-index: 5;
      }

      :global(#tooltip-overlay) {
        position: absolute;
        z-index: 10000;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
    </style>
  </template>
}
