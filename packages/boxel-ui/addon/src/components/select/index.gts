import type { TemplateOnlyComponent } from '@ember/component/template-only';
import PowerSelect, {
  type PowerSelectArgs,
} from 'ember-power-select/components/power-select';
import BeforeOptions from 'ember-power-select/components/power-select/before-options';

import cn from '../../helpers/cn.ts';

export interface BoxelSelectArgs<ItemT> extends PowerSelectArgs {
  options: ItemT[];
}

interface Signature<ItemT = any> {
  Args: BoxelSelectArgs<ItemT>;
  Blocks: {
    default: [ItemT];
  };
  Element: HTMLElement;
}

const BoxelSelect: TemplateOnlyComponent<Signature> = <template>
  {{! template-lint-disable no-autofocus-attribute }}
  <PowerSelect
    class='boxel-select'
    @options={{@options}}
    @searchField={{@searchField}}
    @selected={{@selected}}
    @selectedItemComponent={{@selectedItemComponent}}
    @placeholder={{@placeholder}}
    @onChange={{@onChange}}
    @onBlur={{@onBlur}}
    @renderInPlace={{@renderInPlace}}
    @verticalPosition={{@verticalPosition}}
    @dropdownClass={{cn 'boxel-select__dropdown' @dropdownClass}}
    @triggerComponent={{@triggerComponent}}
    @disabled={{@disabled}}
    @matchTriggerWidth={{@matchTriggerWidth}}
    @eventType='click'
    @searchEnabled={{@searchEnabled}}
    @beforeOptionsComponent={{component BeforeOptions autofocus=false}}
    ...attributes
    as |item|
  >
    {{yield item}}
  </PowerSelect>

  <style scoped>
    .boxel-select {
      border: 1px solid var(--boxel-form-control-border-color);
      border-radius: var(--boxel-form-control-border-radius);
      background: none;
      display: flex;
      gap: var(--boxel-sp-sm);
    }

    .boxel-select:after {
      display: none;
    }
  </style>
  {{! Note: When editing dropdown of the PowerSelect component we target
  the styles using :global -- this is not a mistake. The reason we do this is because
  content is teleported to an element #ember-basic-dropdown-wormhole at the top of the dom
  Therefore, our out-of-the-box scoped css solution do not work and we must use an escape hatch (ie :global) to
  ensure styles are being applied correctly.
   }}
  <style scoped>
    :global(.boxel-select__dropdown) {
      --boxel-select-current-color: var(--boxel-highlight);
      --boxel-select-selected-color: var(--boxel-light-100);
      box-shadow: var(--boxel-box-shadow);
      border-radius: var(--boxel-form-control-border-radius);
    }
    :global(.boxel-select__dropdown ul) {
      list-style: none;
      padding: 0;
      overflow: auto;
    }
    :global(
        .boxel-select__dropdown .ember-power-select-option[aria-selected='true']
      ) {
      background-color: var(--boxel-select-selected-color);
    }

    :global(
        .boxel-select__dropdown .ember-power-select-option[aria-current='true']
      ) {
      background-color: var(--boxel-select-current-color);
      color: black;
    }

    :global(.boxel-select__dropdown .ember-power-select-search-input:focus) {
      border: 1px solid var(--boxel-outline-color);
      box-shadow: var(--boxel-box-shadow-hover);
      outline: var(--boxel-outline);
    }

    :global(
        .boxel-select__dropdown .ember-power-select-option--no-matches-message
      ) {
      padding: var(--boxel-sp-xxs) var(--boxel-sp-sm);
    }
  </style>
</template>;

export default BoxelSelect;
