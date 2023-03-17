import Component from '@glimmer/component';
import {
  chooseCard,
  catalogEntryRef,
  identifyCard,
  internalKeyFor,
  moduleFrom,
} from '@cardstack/runtime-common';
import { isCardRef, type CardRef } from '@cardstack/runtime-common/card-ref';
import { getCardType, type Type } from '../resources/card-type';
import { action } from '@ember/object';
import { service } from '@ember/service';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { eq } from '../helpers/truth-helpers';
import { RealmPaths } from '@cardstack/runtime-common/paths';
//@ts-ignore cached not available yet in definitely typed
import { cached, tracked } from '@glimmer/tracking';
import { LinkTo } from '@ember/routing';
//@ts-ignore glint does not think this is consumed-but it is consumed in the template
import { hash } from '@ember/helper';
import CatalogEntryEditor from './catalog-entry-editor';
import { restartableTask } from 'ember-concurrency';
import Modifier from 'ember-modifier';
import type LoaderService from '../services/loader-service';
import type CardService from '../services/card-service';
import type { ModuleSyntax } from '@cardstack/runtime-common/module-syntax';
import type { FileResource } from '../resources/file';
import type { CatalogEntry } from 'https://cardstack.com/base/catalog-entry';
import type { Card, FieldType } from 'https://cardstack.com/base/card-api';
import BoxelInput from '@cardstack/boxel-ui/components/input';
import FieldContainer from '@cardstack/boxel-ui/components/field-container';
import CardContainer from '@cardstack/boxel-ui/components/card-container';
import Label from '@cardstack/boxel-ui/components/label';
import type { Filter } from '@cardstack/runtime-common/query';

interface Signature {
  Args: {
    card: typeof Card;
    file: FileResource;
    moduleSyntax: ModuleSyntax;
  };
}

export default class Schema extends Component<Signature> {
  <template>
    {{#if this.cardType.type}}
      <CardContainer @displayBoundaries={{true}} class='schema'>
        <FieldContainer @label='Card ID:' data-test-card-id>
          {{this.cardType.type.id}}
        </FieldContainer>
        <FieldContainer @label='Adopts From:' data-test-adopts-from>
          {{this.cardType.type.super.id}}
        </FieldContainer>
        <section>
          <Label>Fields:</Label>
          <ul>
            {{#each this.cardType.type.fields as |field|}}
              <li data-test-field={{field.name}}>
                {{#if (this.isOwnField field.name)}}
                  <button
                    type='button'
                    {{on 'click' (fn this.deleteField field.name)}}
                    data-test-delete
                  >Delete</button>
                {{/if}}
                {{field.name}}
                -
                {{field.type}}
                - field card ID:
                {{#if (this.isThisCard field.card)}}
                  {{cardId field.card}}
                  (this card)
                {{else if (this.inRealm (cardModule field.card))}}
                  <LinkTo
                    @route='code'
                    @query={{hash
                      path=(this.modulePath (cardModule field.card))
                    }}
                  >
                    {{cardId field.card}}
                  </LinkTo>
                {{else}}
                  {{cardId field.card}}
                {{/if}}
              </li>
            {{/each}}
            <p>
              {{#if this.errorMsg}}
                <div class='error' data-test-error-msg>{{this.errorMsg}}</div>
              {{/if}}
            </p>
          </ul>
        </section>
        <fieldset class='add-new-field'>
          <legend>Add New Field</legend>
          <FieldContainer @label='Field Name:' @tag='label'>
            <BoxelInput
              data-test-new-field-name
              type='text'
              @value={{this.newFieldName}}
              @onInput={{this.setNewFieldName}}
            />
          </FieldContainer>
          <FieldContainer @label='Field Type:'>
            <ul class='schema__new-field-type'>
              <li>
                <label>
                  <input
                    data-test-new-field-contains
                    {{RadioInitializer (eq this.newFieldType 'contains') true}}
                    type='radio'
                    checked={{eq this.newFieldType 'contains'}}
                    {{on 'change' (fn this.setNewFieldType 'contains')}}
                    name='field-type'
                  />
                  contains
                </label>
              </li>
              <li>
                <label>
                  <input
                    data-test-new-field-containsMany
                    {{RadioInitializer
                      (eq this.newFieldType 'containsMany')
                      true
                    }}
                    type='radio'
                    checked={{eq this.newFieldType 'containsMany'}}
                    {{on 'change' (fn this.setNewFieldType 'containsMany')}}
                    name='field-type'
                  />
                  containsMany
                </label>
              </li>
              <li>
                <label>
                  <input
                    data-test-new-field-linksTo
                    {{RadioInitializer (eq this.newFieldType 'linksTo') true}}
                    type='radio'
                    checked={{eq this.newFieldType 'linksTo'}}
                    {{on 'change' (fn this.setNewFieldType 'linksTo')}}
                    name='field-type'
                  />
                  linksTo
                </label>
              </li>
            </ul>
          </FieldContainer>
          <button
            data-test-add-field
            type='button'
            disabled={{this.isNewFieldDisabled}}
            {{on 'click' this.addField}}
          >
            Add Field
          </button>
        </fieldset>
      </CardContainer>
      <CatalogEntryEditor @ref={{this.ref}} />
    {{/if}}
  </template>

  @service declare loaderService: LoaderService;
  @service declare cardService: CardService;
  @tracked newFieldName: string | undefined;
  @tracked newFieldType: FieldType = 'contains';

  @cached
  get ref() {
    let ref = identifyCard(this.args.card);
    if (!ref) {
      throw new Error(`bug: unable to identify card ${this.args.card.name}`);
    }
    return ref as { module: string; name: string };
  }

  @cached
  get realmPath() {
    return new RealmPaths(
      this.loaderService.loader.reverseResolution(
        this.cardService.defaultURL.href
      )
    );
  }

  @cached
  get cardType() {
    return getCardType(this, () => this.args.card);
  }

  get isNewFieldDisabled() {
    return Boolean(this.errorMsg) || !this.newFieldName;
  }

  @cached
  get errorMsg(): string | undefined {
    if (!this.newFieldName) {
      return;
    }
    if (
      this.cardType.type?.fields.find(
        (field) => field.name === this.newFieldName
      )
    ) {
      return `The field name "${this.newFieldName}" already exists, please choose a different name.`;
    }
    return;
  }

  @action
  isOwnField(fieldName: string): boolean {
    return Object.keys(
      Object.getOwnPropertyDescriptors(this.args.card.prototype)
    ).includes(fieldName);
  }
  @action
  isThisCard(card: Type | CardRef): boolean {
    return (
      internalKeyFor(this.ref, undefined) ===
      (isCardRef(card) ? internalKeyFor(card, undefined) : card.id)
    );
  }

  @action
  inRealm(url: string): boolean {
    return this.realmPath.inRealm(new URL(url));
  }

  @action
  modulePath(url: string): string {
    return this.realmPath.local(new URL(url));
  }

  @action
  addField() {
    this.makeField.perform();
  }

  @action
  deleteField(fieldName: string) {
    this.args.moduleSyntax.removeField(
      { type: 'exportedName', name: this.ref.name },
      fieldName
    );
    this.write.perform(this.args.moduleSyntax.code());
  }

  @action
  setNewFieldName(value: string) {
    this.newFieldName = value;
  }

  @action
  setNewFieldType(fieldType: FieldType) {
    this.newFieldType = fieldType;
  }

  private makeField = restartableTask(async () => {
    let filter: Filter =
      this.newFieldType === 'linksTo'
        ? {
            on: catalogEntryRef,
            eq: { isPrimitive: false },
          }
        : {
            on: catalogEntryRef,
            not: {
              eq: { ref: this.ref },
            },
          };
    let fieldEntry: CatalogEntry | undefined = await chooseCard({
      filter,
    });
    if (!fieldEntry) {
      return;
    }

    if (!this.newFieldName) {
      throw new Error('bug: new field name is not specified');
    }
    this.args.moduleSyntax.addField(
      { type: 'exportedName', name: this.ref.name },
      this.newFieldName,
      fieldEntry.ref,
      this.newFieldType
    );
    await this.write.perform(this.args.moduleSyntax.code());
  });

  private write = restartableTask(async (src: string) => {
    if (this.args.file.state !== 'ready') {
      throw new Error(`the file ${this.args.file.url} is not open`);
    }
    // note that this write will cause the component to rerender, so
    // any code after this write will not be executed since the component will
    // get torn down before subsequent code can execute
    this.args.file.writeTask.perform(src, true);
  });
}

function cardId(card: Type | CardRef): string {
  if (isCardRef(card)) {
    return internalKeyFor(card, undefined);
  } else {
    return card.id;
  }
}

function cardModule(card: Type | CardRef): string {
  if (isCardRef(card)) {
    return moduleFrom(card);
  } else {
    return card.module;
  }
}

interface RadioInitializerSignature {
  element: HTMLInputElement;
  Args: {
    Positional: [model: boolean, inputType: boolean];
  };
}

class RadioInitializer extends Modifier<RadioInitializerSignature> {
  modify(
    element: HTMLInputElement,
    [model, inputType]: RadioInitializerSignature['Args']['Positional']
  ) {
    element.checked = model === inputType;
  }
}
