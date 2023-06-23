import type { TemplateOnlyComponent } from '@ember/component/template-only';
import cn from '../../helpers/cn';
import element from '../../helpers/element';
import { eq, not, or } from '../../helpers/truth-helpers';
import { svgJar } from '../../helpers/svg-jar';
import Label from '../label';

export interface Signature {
  Element: HTMLElement;
  Args: {
    tag?: keyof HTMLElementTagNameMap;
    centeredDisplay?: boolean;
    fieldId?: string;
    label: string;
    horizontalLabelSize?: string;
    icon?: string;
    vertical?: boolean;
  };
  Blocks: {
    default: [];
  };
}

const FieldContainer: TemplateOnlyComponent<Signature> = <template>
  {{#let (element @tag) as |Tag|}}
    <Tag
      class={{cn
        'boxel-field'
        vertical=(or @vertical @centeredDisplay)
        horizontal=(not (or @vertical @centeredDisplay))
        small-label=(eq @horizontalLabelSize 'small')
        centered-display=@centeredDisplay
      }}
      data-test-boxel-field
      data-test-boxel-field-id={{@fieldId}}
      ...attributes
    >
      <Label class='label' data-test-boxel-field-label>
        {{@label}}
      </Label>

      {{#if @icon}}
        <div class='with-icon'>
          {{svgJar @icon class='boxel-field__icon' role='presentation'}}
          <div class='yield-with-icon'>
            {{yield}}
          </div>
        </div>
      {{else}}
        {{yield}}
      {{/if}}
    </Tag>
  {{/let}}
  <style>
    .boxel-field {
      --boxel-field-label-align: normal;
      --boxel-field-label-padding-top: 0;

      display: grid;
      gap: var(--boxel-sp-xs) 0;
      overflow-wrap: anywhere;
    }

    .vertical {
      grid-template-rows: auto 1fr;
    }

    .centered-display {
      justify-items: center;
    }

    .centered-display > *:last-child {
      order: -1;
    }

    .horizontal {
      grid-template-columns: var(--boxel-field-label-size, minmax(4rem, 25%)) 1fr;
      gap: 0 var(--boxel-sp-lg);
    }

    .small-label {
      --boxel-field-label-size: minmax(4rem, 10%);
    }

    .label {
      display: flex;
      align-items: var(--boxel-field-label-align);
      padding-top: var(--boxel-field-label-padding-top);
    }

    .with-icon {
      display: flex;
    }

    :global(.boxel-field__icon) {
      width: var(--boxel-icon-sm);
      height: var(--boxel-icon-sm);
      margin-right: var(--boxel-sp-xxs);
    }

    .yield-with-icon {
      width: 100%;
    }
  </style>
</template>;

export default FieldContainer;
