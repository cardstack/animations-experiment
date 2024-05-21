import { GridContainer } from '@cardstack/boxel-ui/components';

import {
  contains,
  linksTo,
  linksToMany,
  field,
  Component,
} from 'https://cardstack.com/base/card-api';
import CardDef from 'https://cardstack.com/base/card-def';
import StringCard from 'https://cardstack.com/base/string';

import { Person } from './person';
import { Pet } from './pet';

export class PetPerson extends CardDef {
  static displayName = 'Pet Person';
  @field firstName = contains(StringCard);
  @field friend = linksTo(Person);
  @field pets = linksToMany(Pet);
  @field title = contains(StringCard, {
    computeVia: function (this: PetPerson) {
      return `${this.firstName} Pet Person`;
    },
  });
  @field description = contains(StringCard, {
    computeVia: () => 'A person with pets',
  });
  @field thumbnailURL = contains(StringCard, { computeVia: () => null });

  static embedded = class Embedded extends Component<typeof this> {
    <template>
      <GridContainer>
        <h3><@fields.firstName /></h3>
        Pets:
        <@fields.pets />
        Friend:
        <@fields.friend />
      </GridContainer>
    </template>
  };
}
