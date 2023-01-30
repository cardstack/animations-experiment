import { contains, field, Card, Component } from 'https://cardstack.com/base/card-api';
import StringCard from 'https://cardstack.com/base/string';
import IntegerCard from 'https://cardstack.com/base/integer';
import { initStyleSheet, attachStyles } from '@cardstack/boxel-ui/attach-styles';
import { CardContainer } from '@cardstack/boxel-ui';

let EXCHANGE_RATES: Record<string, number> = {
  "USD": 1,
  "USDC": 1,
  "DAI": 1,
  "LINK": 0.16995055,
  "EUR": 0.94
}

let styles = initStyleSheet(`
  this {
    display: inline-grid;
    grid-template-columns: var(--boxel-sp) 1fr;
    gap: var(--boxel-sp-xxxs);
  }
  .payment-method__currency {
    font: 700 var(--boxel-font);
  }
`);

class Asset extends Card {
  @field name = contains(StringCard);
  @field symbol = contains(StringCard);
  @field logoURL = contains(StringCard);
  @field exchangeRate = contains(IntegerCard, { computeVia:
    function(this: Asset) { return EXCHANGE_RATES[this.symbol]; }
  });
  static embedded = class Embedded extends Component<typeof Asset> {
    <template>
      <CardContainer {{attachStyles styles}}>
        {{#if @model.logoURL}}
          {{!-- 
            TODO: we need a better solution for images--this approach relies 
            on absolute URL's and just doesn't work in a multi-environment system,
            i.e. there is no value you can put here that will work in dev and staging 
          --}}
          <img src={{@model.logoURL}} width="20" height="20"/>
        {{/if}}
        <div class="payment-method__currency"><@fields.symbol/></div>
      </CardContainer>
    </template>
  };
}

// For fiat money
export class Currency extends Asset {
  @field sign = contains(StringCard); // $, €, £, ¥, ₽, ₿ etc.
}

// For crypto
export class Token extends Asset {
  @field address = contains(StringCard);
}
