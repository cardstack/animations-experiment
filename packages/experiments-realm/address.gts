import {
  contains,
  field,
  Component,
  FieldDef,
} from 'https://cardstack.com/base/card-api';
import StringField from 'https://cardstack.com/base/string';
import { CountryField } from './country';
import MapPinIcon from '@cardstack/boxel-icons/map-pin';
import { EntityDisplay } from './components/entity-display';

function getAddressRows(
  addressLine1: string | undefined,
  addressLine2: string | undefined,
  city: string | undefined,
  state: string | undefined,
  postalCode: string | undefined,
  countryCode: string | undefined,
  poBoxNumber: string | undefined,
): string[] {
  return [
    poBoxNumber ? [`PO Box: ${poBoxNumber}`] : [],
    addressLine1 ? [addressLine1] : [],
    addressLine2 ? [addressLine2] : [],
    [city, state, postalCode].filter(Boolean),
    countryCode ? [countryCode] : [],
  ]
    .filter(Boolean)
    .filter((r) => r.length > 0)
    .map((r) => r.join(', '));
}

class Atom extends Component<typeof Address> {
  get label() {
    return (
      [this.args.model?.city, this.args.model?.country?.code]
        .filter(Boolean)
        .join(', ') || ''
    );
  }
  <template>
    <EntityDisplay @name={{this.label}}>
      <:thumbnail>
        <MapPinIcon class='icon' />
      </:thumbnail>
    </EntityDisplay>
  </template>
}

export class Address extends FieldDef {
  static displayName = 'Address';
  static icon = MapPinIcon;
  @field addressLine1 = contains(StringField);
  @field addressLine2 = contains(StringField);
  @field city = contains(StringField);
  @field state = contains(StringField);
  @field postalCode = contains(StringField);
  @field country = contains(CountryField);
  @field poBoxNumber = contains(StringField);
  @field fullAddress = contains(StringField, {
    computeVia: function (this: Address) {
      let rows = getAddressRows(
        this.addressLine1,
        this.addressLine2,
        this.city,
        this.state,
        this.postalCode,
        this.country?.name,
        this.poBoxNumber,
      );
      return rows.join(', ');
    },
  });

  static embedded = class Embedded extends Component<typeof this> {
    get addressRows() {
      return getAddressRows(
        this.args.model.addressLine1,
        this.args.model.addressLine2,
        this.args.model.city,
        this.args.model.state,
        this.args.model.postalCode,
        this.args.model.country?.name,
        this.args.model.poBoxNumber,
      );
    }

    <template>
      <address>
        {{#each this.addressRows as |r|}}
          <div>
            {{r}}
          </div>
        {{/each}}
      </address>
    </template>
  };

  static atom = Atom;
}
