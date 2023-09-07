import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { hash } from '@ember/helper';
import type { ComponentLike } from '@glint/template';
import AccordionItem, { type AccordionItemArgs } from './item';

interface Signature {
  Element: HTMLDivElement;
  Blocks: {
    default: [{ Item: ComponentLike<AccordionItemArgs> }];
  };
}

const Accordion: TemplateOnlyComponent<Signature> = <template>
  <div class='accordion' ...attributes>
    {{yield (hash Item=(component AccordionItem className='item'))}}
  </div>
  <style>
    .accordion {
      --accordion-background-color: var(--boxel-light);
      --accordion-border: var(--boxel-border);
      --accordion-border-radius: var(--boxel-border-radius-xl);

      background-color: var(--accordion-background-color);
      border: var(--accordion-border);
      border-radius: var(--accordion-border-radius);
    }
    :global(.accordion > .item + .item) {
      border-top: var(--accordion-border);
    }
  </style>
</template>;

export default Accordion;
