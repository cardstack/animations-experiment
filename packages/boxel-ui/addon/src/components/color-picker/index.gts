import { on } from '@ember/modifier';
import Component from '@glimmer/component';

interface Signature {
  Args: {
    color: string;
    disabled?: boolean;
    onChange: (color: string) => void;
    showHexString?: boolean;
  };
  Element: HTMLDivElement;
}

export default class ColorPicker extends Component<Signature> {
  private handleColorChange = (event: Event) => {
    let input = event.target as HTMLInputElement;
    this.args.onChange(input.value);
  };

  <template>
    <div class='color-picker' ...attributes>
      <input
        type='color'
        value={{@color}}
        class='input'
        disabled={{@disabled}}
        aria-label='Choose color'
        {{on 'input' this.handleColorChange}}
      />
      {{#if @showHexString}}
        <span class='hex-value'>{{@color}}</span>
      {{/if}}
    </div>

    <style scoped>
      .color-picker {
        --swatch-size: 1.4rem;
        display: inline-flex;
        align-items: center;
        gap: var(--boxel-sp-xs);
      }

      .input {
        width: var(--swatch-size);
        height: var(--swatch-size);
        padding: 0;
        border: none;
        cursor: pointer;
        background: transparent;
        border: 1px solid var(--boxel-200);
        border-radius: 50%;
      }

      .input:disabled {
        pointer-events: none;
      }

      .input::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      .input::-webkit-color-swatch {
        border: 1px solid transparent;
        border-radius: 50%;
      }

      .hex-value {
        font: var(--boxel-font);
        color: var(--boxel-dark);
        text-transform: uppercase;
      }
    </style>
  </template>
}
