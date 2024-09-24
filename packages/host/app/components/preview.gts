import Component from '@glimmer/component';

import { provide } from 'ember-provide-consume-context';

import {
  CardContextName,
  DefaultFormatsContextName,
  ResolvedCodeRef,
} from '@cardstack/runtime-common';

import type {
  BaseDef,
  CardContext,
  Format,
  Field,
} from 'https://cardstack.com/base/card-api';

import PrerenderedCardSearch from './prerendered-card-search';

interface Signature {
  Element: any;
  Args: {
    card: BaseDef;
    format?: Format;
    field?: Field;
    codeRef?: ResolvedCodeRef;
    cardContext?: Partial<CardContext>;
  };
}

export default class Preview extends Component<Signature> {
  @provide(DefaultFormatsContextName)
  // @ts-ignore "defaultFormat is declared but not used"
  get defaultFormat() {
    let { format } = this.args;
    format = format ?? 'isolated';
    return { cardDef: format, fieldDef: format };
  }

  @provide(CardContextName)
  // @ts-ignore "context is declared but not used"
  private get context() {
    return {
      prerenderedCardSearchComponent: PrerenderedCardSearch,
      ...this.args.cardContext,
    };
  }

  <template>
    <this.renderedCard ...attributes />
  </template>

  get renderedCard() {
    return this.args.card.constructor.getComponent(
      this.args.card,
      this.args.field,
      this.args.codeRef ? { componentCodeRef: this.args.codeRef } : undefined,
    );
  }
}
