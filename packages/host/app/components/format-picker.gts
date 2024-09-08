import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';

import { eq } from '@cardstack/boxel-ui/helpers';

import type { Format } from 'https://cardstack.com/base/card-api';

interface Signature {
  Args: {
    formats: Format[] | undefined;
    setFormat: (format: Format) => void;
    format?: Format;
  };
}

const FormatPicker: TemplateOnlyComponent<Signature> = <template>
  <div class='format-picker'>
    Format:
    {{#each @formats as |format|}}
      <button
        {{on 'click' (fn @setFormat format)}}
        type='button'
        class='format-button {{format}} {{if (eq @format format) "selected"}}'
        disabled={{eq @format format}}
        data-test-format-button={{format}}
      >
        {{format}}
      </button>
    {{/each}}
  </div>
  <style scoped>
    .format-picker {
      margin-bottom: var(--boxel-sp);
    }
  </style>
</template>;

export default FormatPicker;
