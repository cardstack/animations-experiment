import GlimmerComponent from '@glimmer/component';
import { startCase } from 'lodash';
import type { CardBase } from './card-api';
import { eq } from '@cardstack/boxel-ui/helpers/truth-helpers';
import { FieldContainer } from '@cardstack/boxel-ui';

class DefaultTemplate extends GlimmerComponent<{
  Args: {
    model: CardBase;
    fields: Record<string, new () => GlimmerComponent>;
  };
}> {
  <template>
    <div class='default-card'>
      {{#each-in @fields as |key Field|}}
        {{#unless (eq key 'id')}}
          <FieldContainer
            {{! @glint-ignore (glint is arriving at an incorrect type signature for 'startCase') }}
            @label={{startCase key}}
            data-test-field={{key}}
          >
            <Field />
          </FieldContainer>
        {{/unless}}
      {{/each-in}}
    </div>
  </template>
}

export const defaultComponent = {
  embedded: <template>
    <!-- Inherited from base card embedded view. Did your card forget to specify its embedded component? -->
  </template>,
  isolated: DefaultTemplate,
  edit: DefaultTemplate,
};
