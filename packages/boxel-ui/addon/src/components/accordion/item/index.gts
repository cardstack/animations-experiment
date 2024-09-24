import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { on } from '@ember/modifier';

import cn from '../../../helpers/cn.ts';
import DropdownArrowDown from '../../../icons/dropdown-arrow-down.gts';

export interface AccordionItemSignature {
  Args: {
    className?: string;
    contentClass?: string;
    isOpen: boolean;
    onClick: (event: MouseEvent) => void;
  };
  Blocks: {
    content: [];
    title: [];
  };
  Element: HTMLDivElement;
}

const AccordionItem: TemplateOnlyComponent<AccordionItemSignature> = <template>
  <div class={{cn 'accordion-item' @className open=@isOpen}} ...attributes>
    <button class='title' {{on 'click' @onClick}}>
      <span class='caret'>
        <DropdownArrowDown width={{12}} height={{12}} />
      </span>
      {{yield to='title'}}
    </button>
    <div class={{cn 'content' @contentClass}}>
      {{yield to='content'}}
    </div>
  </div>
  <style scoped>
    .accordion-item {
      --accordion-item-closed-height: 2.75rem;
      --accordion-item-open-height: 8rem;
      --accordion-item-border: var(--accordion-border);
      --accordion-item-title-font: 600 var(--boxel-font);
      --accordion-item-title-letter-spacing: var(--boxel-lsp-xs);
      --accordion-item-title-padding: var(--boxel-sp-xs);

      height: var(--accordion-item-closed-height);
      display: flex;
      flex-direction: column;
      transition: all var(--boxel-transition);
    }
    .accordion-item.open {
      height: var(--accordion-item-open-height);
      flex: 1;
    }
    .content {
      flex: 1;
      opacity: 0;
      display: none;
    }
    .accordion-item.open > .content {
      display: block;
      opacity: 1;
      border-top: var(--accordion-item-border);
      transition: all var(--boxel-transition);
    }
    .title {
      display: flex;
      padding: var(--accordion-item-title-padding);
      font: var(--accordion-item-title-font);
      letter-spacing: var(--accordion-item-title-letter-spacing);
      background-color: transparent;
      border: none;
      text-align: left;
    }
    .title:hover {
      cursor: pointer;
    }
    .caret {
      --icon-color: var(--boxel-highlight);
      display: inline-block;
      width: var(--boxel-icon-sm);
      height: var(--boxel-icon-sm);
    }

    .caret :deep(svg) {
      transform: rotate(-90deg);
      transition: transform var(--boxel-transition);
    }

    .accordion-item.open > .title > .caret :deep(svg) {
      transform: rotate(0deg);
    }
  </style>
</template>;

export default AccordionItem;
