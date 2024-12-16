import NumberField from 'https://cardstack.com/base/number';
import { FieldDef, field, contains } from 'https://cardstack.com/base/card-api';
import { Component } from 'https://cardstack.com/base/card-api';
import { CurrencyField } from './currency';
import { action } from '@ember/object';
import { BoxelInputGroup } from '@cardstack/boxel-ui/components';
import { guidFor } from '@ember/object/internals';

// @ts-ignore
import { getSymbolFromCode } from 'https://esm.run/currency-code-symbol-map';

class View extends Component<typeof AmountWithCurrency> {
  get formatNumberWithSeparator() {
    const num = this.args.model.amount;
    const currencyCode = this.args.model.currency?.code;
    const currencySymbol = getSymbolFromCode(currencyCode) || '';

    if (num === null || num === undefined) {
      return '';
    }

    return `${currencySymbol} ${num.toLocaleString('en-US')}`;
  }

  <template>
    {{this.formatNumberWithSeparator}}
  </template>
}

class Edit extends Component<typeof AmountWithCurrency> {
  get id() {
    return guidFor(this);
  }

  @action
  setAmount(val: number) {
    let newModel = new AmountWithCurrency();
    newModel.amount = val;
    newModel.currency = this.args.model.currency as CurrencyField;
    this.args.set(newModel);
  }

  @action
  setCurrency(val: CurrencyField) {
    let newModel = new AmountWithCurrency();
    newModel.amount = this.args.model.amount as number;
    newModel.currency = val;
    this.args.set(newModel);
  }

  <template>
    <BoxelInputGroup
      @id={{this.id}}
      @placeholder='0.00'
      @value={{@model.amount}}
      @invalid={{false}}
      @onInput={{this.setAmount}}
      @autocomplete='off'
      @inputmode='decimal'
      class='input-selectable-currency-amount'
    >
      <:before as |Accessories|>
        <Accessories.Text>{{@model.currency.symbol}}</Accessories.Text>
      </:before>
      <:after>
        <div class='input-selectable-currency'>
          <@fields.currency style='height: 100%;' />
        </div>
      </:after>
    </BoxelInputGroup>
    <style scoped>
      .input-selectable-currency-amount {
        position: relative;
        width: 100%;
      }

      .input-selectable-currency-amount__select[aria-disabled='true'] {
        opacity: 0.5;
      }

      .input-selectable-currency-amount__dropdown-item {
        white-space: nowrap;
      }

      .input-selectable-currency-amount__dropdown
        :deep(.ember-power-select-options[role='listbox']) {
        max-height: 18em;
      }

      :deep(.currency-field-edit) {
        min-width: 100px;
        font-size: var(--boxel-font-size-sm);
      }

      .boxel-selectable-currency-icon__icon {
        margin-right: var(--boxel-sp-xxxs);
        vertical-align: bottom;
        width: var(--boxel-icon-sm);
        height: var(--boxel-icon-sm);
      }
    </style>
  </template>
}

export class AmountWithCurrency extends FieldDef {
  static displayName = 'AmountWithCurrency';

  @field amount = contains(NumberField);
  @field currency = contains(CurrencyField);

  static edit = Edit;
  static atom = View;
  static embedded = View;
}
