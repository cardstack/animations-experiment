import GlimmerComponent from '@glimmer/component';
import { on } from '@ember/modifier';
import { fn } from '@ember/helper';
import {
  type Card,
  CardBase,
  type Box,
  type Format,
  type Field,
  CardContext,
} from './card-api';
import { getBoxComponent, getPluralViewComponent } from './field-component';
import type { ComponentLike } from '@glint/template';
import { IconButton } from '@cardstack/boxel-ui';
import {
  restartableTask,
  type EncapsulatedTaskDescriptor as Descriptor,
} from 'ember-concurrency';
import {
  chooseCard,
  baseCardRef,
  identifyCard,
  getPlural,
} from '@cardstack/runtime-common';
import { svgJar } from '@cardstack/boxel-ui/helpers/svg-jar';

interface Signature {
  Args: {
    model: Box<Card>;
    arrayField: Box<Card[]>;
    format: Format;
    field: Field<typeof Card>;
    cardTypeFor(
      field: Field<typeof CardBase>,
      boxedElement: Box<CardBase>,
    ): typeof CardBase;
    context?: CardContext;
  };
}

class LinksToManyEditor extends GlimmerComponent<Signature> {
  <template>
    <div
      class='contains-many-editor'
      data-test-links-to-many={{this.args.field.name}}
    >
      {{#if @arrayField.children.length}}
        <ul>
          {{#each @arrayField.children as |boxedElement i|}}
            <li class='links-to-editor' data-test-item={{i}}>
              {{#let
                (getBoxComponent
                  (this.args.cardTypeFor @field boxedElement)
                  'embedded'
                  boxedElement
                  @field
                  @context
                )
                as |Item|
              }}
                <Item />
              {{/let}}
              <IconButton
                @icon='icon-minus-circle'
                @width='20px'
                @height='20px'
                class='remove-icon-button'
                {{on 'click' (fn this.remove i)}}
                data-test-remove-card
                data-test-remove={{i}}
                aria-label='Remove'
              />
            </li>
          {{/each}}
        </ul>
      {{/if}}
      <div class='add-new' {{on 'click' this.add}} data-test-add-new>
        {{svgJar 'icon-plus' width='20px' height='20px'}}
        Add
        {{getPlural @field.card.displayName}}
      </div>
    </div>
    <style>
      .add-new {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--boxel-sp-xxxs);

        background: var(--boxel-light-100);
        box-sizing: border-box;
        cursor: pointer;
        width: 100%;
        height: calc(var(--boxel-sp-xxxl) * var(--boxel-ratio));
        border: 1px solid var(--boxel-form-control-border-color);
        border-radius: var(--boxel-form-control-border-radius);
        color: var(--boxel-teal);
        font: var(--boxel-font-sm);
        font-weight: 500;
        letter-spacing: var(--boxel-lsp-xs);
        transition: border-color var(--boxel-transition);
        --icon-color: var(--boxel-teal);
      }
    </style>
  </template>

  add = () => {
    (this.chooseCard as unknown as Descriptor<any, any[]>).perform();
  };

  private chooseCard = restartableTask(async () => {
    let selectedCards = (this.args.model.value as any)[this.args.field.name];
    let selectedCardsQuery =
      selectedCards?.map((card: any) => ({ not: { eq: { id: card.id } } })) ??
      [];
    let type = identifyCard(this.args.field.card) ?? baseCardRef;
    let filter = { every: [{ type }, ...selectedCardsQuery] };
    let chosenCard: Card | undefined = await chooseCard(
      { filter },
      {
        offerToCreate: type,
        multiSelect: true,
        createNewCard: this.args.context?.actions?.createCard,
      },
    );
    if (chosenCard) {
      selectedCards = [...selectedCards, chosenCard];
      (this.args.model.value as any)[this.args.field.name] = selectedCards;
    }
  });

  remove = (index: number) => {
    let cards = (this.args.model.value as any)[this.args.field.name];
    cards = cards.filter((_c: Card, i: number) => i !== index);
    (this.args.model.value as any)[this.args.field.name] = cards;
  };
}

export function getLinksToManyComponent({
  model,
  arrayField,
  format,
  field,
  cardTypeFor,
  context,
}: {
  model: Box<Card>;
  arrayField: Box<Card[]>;
  format: Format;
  field: Field<typeof Card>;
  cardTypeFor(
    field: Field<typeof CardBase>,
    boxedElement: Box<CardBase>,
  ): typeof CardBase;
  context?: CardContext;
}): ComponentLike<{ Args: {}; Blocks: {} }> {
  if (format === 'edit') {
    return class LinksToManyEditorTemplate extends GlimmerComponent {
      <template>
        <LinksToManyEditor
          @model={{model}}
          @arrayField={{arrayField}}
          @field={{field}}
          @format={{format}}
          @cardTypeFor={{cardTypeFor}}
          @context={{context}}
        />
      </template>
    };
  } else {
    return getPluralViewComponent(
      arrayField,
      field,
      format,
      cardTypeFor,
      context,
    );
  }
}
