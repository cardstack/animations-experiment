import {
  contains,
  field,
  Component,
  FieldDef,
  StringField,
} from 'https://cardstack.com/base/card-api';
import { LooseGooseyField, LooseyGooseyData } from './loosey-goosey';
import { PhoneInput, Pill } from '@cardstack/boxel-ui/components';
import { RadioInput } from '@cardstack/boxel-ui/components';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { action } from '@ember/object';
import PhoneIcon from '@cardstack/boxel-icons/phone';

class PhoneNumberTypeEdit extends Component<typeof PhoneNumberType> {
  @tracked label: string | undefined = this.args.model.label;

  get types() {
    return PhoneNumberType.values;
  }

  get selected() {
    return this.types?.find((type) => {
      return type.label === this.label;
    });
  }

  @action onSelect(type: LooseyGooseyData): void {
    this.label = type.label;
    this.args.model.label = this.selected?.label;
    this.args.model.index = this.selected?.index;
  }
  <template>
    <RadioInput
      @groupDescription='Office, Work, Home '
      @items={{this.types}}
      @checkedId={{this.selected.label}}
      @orientation='horizontal'
      @spacing='default'
      @keyName='label'
      as |item|
    >
      <item.component @onChange={{fn this.onSelect item.data}}>
        {{item.data.label}}
      </item.component>
    </RadioInput>
  </template>
}

export class PhoneNumberType extends LooseGooseyField {
  static displayName = 'Phone Number Type';
  static values = [
    { index: 0, label: 'Mobile' },
    { index: 1, label: 'Home' },
    { index: 2, label: 'Work' },
  ];
  static edit = PhoneNumberTypeEdit;
}

export class PhoneNumber extends FieldDef {
  static displayName = 'Phone Number';
  @field number = contains(StringField);
  @field countryCode = contains(StringField);

  setNumber = (number: string) => {
    this.number = number;
  };

  setCountryCode = (code: string) => {
    this.countryCode = code;
  };

  static edit = class Edit extends Component<typeof PhoneNumber> {
    <template>
      <PhoneInput
        @countryCode={{@model.countryCode}}
        @value={{@model.number}}
        @onInput={{@model.setNumber}}
        @onCountryCodeChange={{@model.setCountryCode}}
      />
    </template>
  };

  static atom = class Atom extends Component<typeof PhoneNumber> {
    <template>
      <div class='row'>
        <PhoneIcon class='icon gray' />
        {{#if @model.countryCode}}
          <span>+{{@model.countryCode}}{{@model.number}}</span>
        {{else}}
          <span>{{@model.number}}</span>
        {{/if}}
      </div>
      <style scoped>
        .row {
          display: flex;
          align-items: center;
          word-break: break-all;
          gap: var(--boxel-sp-xxs);
        }
        .icon {
          width: var(--boxel-icon-xs);
          height: var(--boxel-icon-xs);
          flex-shrink: 0;
        }
      </style>
    </template>
  };

  static embedded = class Embedded extends Component<typeof PhoneNumber> {
    <template>
      {{#if @model.countryCode}}
        <span>+{{@model.countryCode}}{{@model.number}}</span>
      {{else}}
        <span>{{@model.number}}</span>
      {{/if}}
    </template>
  };
}

export class ContactPhoneNumber extends FieldDef {
  @field phoneNumber = contains(PhoneNumber);
  @field type = contains(PhoneNumberType);

  static atom = class Atom extends Component<typeof ContactPhoneNumber> {
    <template>
      <div class='row'>
        <@fields.phoneNumber @format='atom' />
        {{#if @model.type.label}}
          <Pill class='gray'>
            {{@model.type.label}}
          </Pill>
        {{/if}}
      </div>
      <style scoped>
        .row {
          display: flex;
          align-items: center;
          gap: var(--boxel-sp-xxs);
          word-break: break-all;
        }
        .gray {
          font-weight: 300;
          font-size: 10px;
          word-break: keep-all;
          --pill-background-color: var(--boxel-200);
          border: none;
        }
      </style>
    </template>
  };

  static embedded = class Embedded extends Component<
    typeof ContactPhoneNumber
  > {
    <template>
      {{#if @model.phoneNumber.countryCode}}
        <span
        >+{{@model.phoneNumber.countryCode}}{{@model.phoneNumber.number}}</span>
      {{else}}
        <span>{{@model.phoneNumber.number}}</span>
      {{/if}}
    </template>
  };
}
