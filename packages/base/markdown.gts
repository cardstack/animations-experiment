import { not } from '@cardstack/boxel-ui/helpers';
import { Component } from './card-api';
import StringField from './string';
import { BoxelInput } from '@cardstack/boxel-ui/components';
import { markdownToHtml } from '@cardstack/runtime-common';

class View extends Component<typeof MarkdownField> {
  <template>
    <div>
      {{{markdownToHtml @model}}}
    </div>
  </template>
}

export default class MarkdownField extends StringField {
  static displayName = 'Markdown';

  static embedded = View;
  static atom = View;

  static edit = class Edit extends Component<typeof this> {
    <template>
      <BoxelInput
        class='boxel-text-area'
        @type='textarea'
        @value={{@model}}
        @onInput={{@set}}
        @disabled={{not @canEdit}}
      />
    </template>
  };
}
