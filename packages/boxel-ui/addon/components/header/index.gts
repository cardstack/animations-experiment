import cn from '../../helpers/cn';
import { or, eq, bool } from '../../helpers/truth-helpers';
import Label from '../label';
import type { TemplateOnlyComponent } from '@ember/component/template-only';

interface Signature {
  Element: HTMLElement;
  Args: {
    icon?: {
      URL: string;
      onMouseEnter?: (e: MouseEvent) => void;
      onMouseLeave?: (e: MouseEvent) => void;
    };
    label?: string;
    title?: string;
    size?: 'large';
    hasBackground?: boolean;
    isHighlighted?: boolean;
  };
  Blocks: {
    default: [];
    actions: [];
    icon: [];
  };
}

const Header: TemplateOnlyComponent<Signature> = <template>
  <header
    class={{cn
      has-background=@hasBackground
      highlighted=@isHighlighted
      large=(or (bool @title) (eq @size 'large'))
    }}
    data-test-boxel-header
    ...attributes
  >
    {{#if (has-block 'icon')}}
      {{yield to='icon'}}
    {{/if}}

    {{#if (or @label @title)}}
      <div data-test-boxel-header-title>
        {{#if @label}}<Label
            data-test-boxel-header-label
          >{{@label}}</Label>{{/if}}
        {{#if @title}}{{@title}}{{/if}}
      </div>
    {{/if}}

    {{yield}}

    {{#if (has-block 'actions')}}
      <div class='content' data-test-boxel-header-content>
        {{yield to='actions'}}
      </div>
    {{/if}}
  </header>
  <style>
    header {
      position: relative;
      display: flex;
      align-items: center;
      padding: 0 var(--boxel-sp-xxxs) 0 var(--boxel-sp-sm);
      min-height: var(--boxel-header-min-height, 1.875rem); /* 30px */
      color: var(--boxel-header-text-color, var(--boxel-dark));
      border-top-right-radius: calc(var(--boxel-border-radius) - 1px);
      border-top-left-radius: calc(var(--boxel-border-radius) - 1px);
      font: 600 var(--boxel-header-text-size, var(--boxel-font-xs));
      letter-spacing: var(--boxel-lsp-xl);
      text-transform: uppercase;
      transition: background-color var(--boxel-transition),
        color var(--boxel-transition);
      gap: var(--boxel-sp-xs);
    }
    .large {
      padding: var(--boxel-header-padding, var(--boxel-sp-xl));
      font: 700 var(--boxel-header-text-size, var(--boxel-font-lg));
      letter-spacing: normal;
      text-transform: none;
    }
    .has-background {
      background-color: var(--boxel-header-background-color, var(--boxel-100));
    }
    .highlighted {
      background-color: var(--boxel-highlight);
    }
    .content {
      position: absolute;
      top: 0;
      right: 0;

      display: flex;
      align-items: center;
      padding: var(--boxel-header-action-padding, 0);
    }

  </style>
</template>;

export default Header;
