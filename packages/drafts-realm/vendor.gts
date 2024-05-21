import {
  contains,
  field,
  relativeTo,
  Component,
  containsMany,
} from 'https://cardstack.com/base/card-api';
import CardDef from 'https://cardstack.com/base/card-def';
import FieldDef from 'https://cardstack.com/base/field-def';
import StringCard from 'https://cardstack.com/base/string';
import TextAreaCard from 'https://cardstack.com/base/text-area';
import { Address } from './address';
import { FieldContainer } from '@cardstack/boxel-ui/components';
import { startCase } from 'lodash';
import { eq } from '@cardstack/boxel-ui/helpers';
import { PaymentMethod } from './payment-method';
import GlimmerComponent from '@glimmer/component';

class VendorDetails extends FieldDef {
  static displayName = 'Vendor';
  @field name = contains(StringCard); // required
  @field description = contains(TextAreaCard);
  @field logoURL = contains(StringCard); // url format
  @field email = contains(StringCard); // email format
  @field cardXYZ = contains(StringCard);
  @field logoHref = contains(StringCard, {
    computeVia: function (this: VendorDetails) {
      if (!this.logoURL) {
        return null;
      }
      return new URL(this.logoURL, this[relativeTo]).href;
    },
  });
  @field title = contains(StringCard, {
    computeVia: function (this: VendorDetails) {
      return this.name;
    },
  });

  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <VendorContainer>
        {{#each-in @fields as |key value|}}
          {{#unless (eq key 'id')}}
            <FieldContainer
              {{! @glint-ignore }}
              @label={{startCase key}}
              @vertical={{true}}
            >
              {{value}}
            </FieldContainer>
          {{/unless}}
        {{/each-in}}
      </VendorContainer>
    </template>
  };
}

class Contact extends FieldDef {
  static displayName = 'Contact';
  @field fullName = contains(StringCard);
  @field preferredName = contains(StringCard);
  @field jobTitle = contains(StringCard);
  @field email = contains(StringCard); // email format
  @field phone = contains(StringCard); // phone number format
  @field cardXYZ = contains(StringCard);
  @field notes = contains(TextAreaCard);
  @field imageURL = contains(StringCard);

  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <VendorContainer>
        {{#each-in @fields as |key value|}}
          {{#unless (eq key 'id')}}
            <FieldContainer
              {{! @glint-ignore }}
              @label={{startCase key}}
              @vertical={{true}}
            >
              {{value}}
            </FieldContainer>
          {{/unless}}
        {{/each-in}}
      </VendorContainer>
    </template>
  };
}

class ContactMethod extends FieldDef {
  static displayName = 'ContactMethod';
  @field platform = contains(StringCard); // Dropdown (Telegram, Discord, Facebook, LinkedIn, Twitter)
  @field username = contains(StringCard);
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <@fields.platform />: <@fields.username />
    </template>
  };
}

export class Vendor extends CardDef {
  static displayName = 'Vendor';
  @field vendor = contains(VendorDetails); // required
  @field contact = contains(Contact); // required
  @field contactMethod = containsMany(ContactMethod);
  @field mailingAddress = contains(Address); // required
  @field preferredPaymentMethod = contains(PaymentMethod); // required
  @field alternatePaymentMethod = containsMany(PaymentMethod);
  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <div class='vendor-card--embedded'>
        <div>
          <@fields.vendor.name />
          <@fields.mailingAddress />
          <@fields.vendor.email />
        </div>
        <img src={{@model.vendor.logoHref}} />
      </div>
      <style>
        .vendor-card--embedded {
          display: grid;
          grid-template-columns: 1fr auto;
        }
      </style>
    </template>
  };
  static isolated = class Isolated extends Component<typeof this> {
    <template>
      <VendorContainer class='container'>
        <section>
          <h2>Title</h2>
          <@fields.title />
        </section>
        <section>
          <h2>Vendor</h2>
          <@fields.vendor />
        </section>
        <section>
          <h2>Contact</h2>
          <@fields.contact />
        </section>
        {{#if @model.contactMethod.length}}
          <section>
            <h2>Contact Method</h2>
            <@fields.contactMethod />
          </section>
        {{/if}}
        <section>
          <h2>Mailing Address</h2>
          <@fields.mailingAddress />
        </section>
        <section>
          <h2>Preferred Payment Method</h2>
          <@fields.preferredPaymentMethod />
          {{#if @model.alternatePaymentMethod.length}}
            <h2>Alternate Payment Method</h2>
            <@fields.alternatePaymentMethod />
          {{/if}}
        </section>
      </VendorContainer>
      <style>
        .container {
          padding: var(--boxel-sp-xl);
        }
      </style>
    </template>
  };
  static edit = class Edit extends Component<typeof this> {
    <template>
      <VendorContainer class='container'>
        <section>
          <h2>Vendor</h2>
          <@fields.vendor />
        </section>
        <section>
          <h2>Contact</h2>
          <@fields.contact />
        </section>
        {{#if @model.contactMethod.length}}
          <section>
            <h2>Contact Method</h2>
            <@fields.contactMethod />
          </section>
        {{/if}}
        <section>
          <h2>Mailing Address</h2>
          <@fields.mailingAddress />
        </section>
        <section>
          <h2>Preferred Payment Method</h2>
          <@fields.preferredPaymentMethod />
          <h2>Alternate Payment Method</h2>
          <@fields.alternatePaymentMethod />
        </section>
      </VendorContainer>
      <style>
        .container {
          padding: var(--boxel-sp-xl) var(--boxel-sp-xxl) var(--boxel-sp-xl)
            var(--boxel-sp-xl);
        }
      </style>
    </template>
  };
}

interface Signature {
  Element: HTMLElement;
  Blocks: {
    default: [];
  };
}

class VendorContainer extends GlimmerComponent<Signature> {
  <template>
    <div class='vendor' ...attributes>
      {{yield}}
    </div>
    <style>
      .vendor :deep(.boxel-field + .boxel-field) {
        margin-top: var(--boxel-sp);
      }
    </style>
  </template>
}
