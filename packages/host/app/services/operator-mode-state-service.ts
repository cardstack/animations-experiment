import {
  type OperatorModeState,
  type Stack,
  type StackItem,
  getCardStackItem,
} from '../components/operator-mode/container';
import Service from '@ember/service';
import type CardService from '../services/card-service';
import { TrackedArray, TrackedObject } from 'tracked-built-ins';
import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { getOwner } from '@ember/application';
import { scheduleOnce } from '@ember/runloop';
import type { Card, Format } from 'https://cardstack.com/base/card-api';
import { type Deferred } from '@cardstack/runtime-common';

// Below types form a raw POJO representation of operator mode state.
// This state differs from OperatorModeState in that it only contains cards that have been saved (i.e. have an ID).
// This is because we don't have a way to serialize a stack configuration of linked cards that have not been saved yet.

interface CardItem {
  type: 'card';
  id: string;
  format: 'isolated' | 'edit';
}
interface ContainedCardItem {
  type: 'contained';
  fieldOfIndex: number; // index of the item in the stack that this is a field of
  fieldName: string;
  format: 'isolated' | 'edit';
}
type SerializedItem = CardItem | ContainedCardItem;

//TODO: If we don't plan on hanging other things off this, then make
// SerializedStack just an alias for an array of StackItems--the "items"
// property is awkward
interface SerializedStack {
  items: SerializedItem[];
}

export type SerializedState = { stacks: SerializedStack[] };

export default class OperatorModeStateService extends Service {
  @tracked state: OperatorModeState = new TrackedObject({
    stacks: new TrackedArray([]),
  });
  @tracked recentCards = new TrackedArray<Card>([]);

  @service declare cardService: CardService;

  async restore(rawState: SerializedState) {
    this.state = await this.deserialize(rawState);
  }

  addItemToStack(item: StackItem) {
    let stackIndex = item.stackIndex;
    if (!this.state.stacks[stackIndex]) {
      this.state.stacks[stackIndex] = new TrackedObject({
        items: new TrackedArray([]),
      });
    }
    this.state.stacks[stackIndex].items.push(item);
    if (item.type === 'card') {
      this.addRecentCards(item.card);
    }
    this.schedulePersist();
  }

  removeItemFromStack(item: StackItem) {
    let stackIndex = item.stackIndex;
    let itemIndex = this.state.stacks[stackIndex].items.indexOf(item);
    this.state.stacks[stackIndex].items.splice(itemIndex); // Always remove anything above the item

    // If the additional stack is now empty, remove it from the state
    if (
      this.state.stacks[stackIndex].items.length === 0 &&
      this.state.stacks.length > 1
    ) {
      this.state.stacks.splice(stackIndex, 1);
    }

    this.schedulePersist();
  }

  popItemFromStack(stackIndex: number) {
    let stack = this.state.stacks[stackIndex];
    if (!stack) {
      throw new Error(`No stack at index ${stackIndex}`);
    }
    let item = stack.items.pop();
    if (!item) {
      throw new Error(`No items in stack at index ${stackIndex}`);
    }
    this.schedulePersist();
    return item;
  }

  // TODO: This seems to be doing 2 jobs: replacing cards in the stack and shifting
  // cards to a different stack. probably we should break this out into
  // different methods
  replaceItemInStack(item: StackItem, newItem: StackItem): StackItem;
  replaceItemInStack(
    item: StackItem,
    addressableCard: Card,
    deferred: Deferred<Card> | undefined,
    format: Format
  ): StackItem;
  replaceItemInStack(
    item: StackItem,
    newItemOrCard: Card | StackItem,
    deferred?: Deferred<Card>,
    format?: Format
  ) {
    let card: Card | undefined;
    let newItem: StackItem | undefined;
    if (this.cardService.isCard(newItemOrCard)) {
      card = newItemOrCard;
    } else {
      newItem = newItemOrCard;
    }

    let stackIndex = item.stackIndex;
    let cardStackItem = getCardStackItem(
      item,
      this.state.stacks[stackIndex].items
    );

    if (newItem && newItem.stackIndex !== stackIndex) {
      this.removeItemFromStack(item);
      this.addItemToStack(newItem);
      this.schedulePersist();
      return newItem;
    }

    if (card && format) {
      newItem = { ...cardStackItem, card, format, request: deferred };
    } else {
      newItem = { ...cardStackItem };
    }
    let index = this.state.stacks[stackIndex].items.indexOf(cardStackItem);
    this.state.stacks[stackIndex].items.splice(index, 1, newItem);
    this.schedulePersist();
    return newItem;
  }

  replaceItemInStack_old(item: StackItem, newItem: StackItem) {
    let stackIndex = item.stackIndex;
    let itemIndex = this.state.stacks[stackIndex].items.indexOf(item);

    if (newItem.stackIndex !== stackIndex) {
      this.removeItemFromStack(item);
      this.addItemToStack(newItem);
      return this.schedulePersist();
    }

    this.state.stacks[stackIndex].items.splice(itemIndex, 1, newItem);
    this.schedulePersist();
  }

  clearStacks() {
    this.state.stacks.splice(0);
    this.schedulePersist();
  }

  private schedulePersist() {
    // When multiple stack manipulations are bunched together in a loop, for example when closing multiple cards in a loop,
    // we get into a async race condition where the change to cardController.operatorModeState will reload the route and
    // restore the state from the query param in a way that is out of sync with the state in the service. To avoid this,
    // we do the change to the query param only after all modifications to the state have been rendered.
    scheduleOnce('afterRender', this, this.persist);
  }

  private persist() {
    let cardController = getOwner(this)!.lookup('controller:card') as any;
    if (!cardController) {
      throw new Error(
        'OperatorModeStateService must be used in the context of a CardController'
      );
    }

    // Setting this property will trigger a query param update on the controller, which will reload the route
    cardController.operatorModeState = this.serialize();
  }

  // Serialized POJO version of state, with only cards that have been saved.
  // The state can have cards that have not been saved yet, for example when
  // clicking on "Crate New" in linked card editor. Here we want to draw a boundary
  // between navigatable states in the query parameter
  rawStateWithSavedCardsOnly() {
    let state: SerializedState = { stacks: [] };

    for (let stack of this.state.stacks) {
      let serializedStack: SerializedStack = { items: [] };
      for (let item of stack.items) {
        if (item.format !== 'isolated' && item.format !== 'edit') {
          throw new Error(`Unknown format for card on stack ${item.format}`);
        }
        if (item.type === 'card') {
          if (item.card.id) {
            serializedStack.items.push({
              type: 'card',
              id: item.card.id,
              format: item.format,
            });
          }
        } else {
          let { fieldName, fieldOfIndex } = item;
          serializedStack.items.push({
            type: 'contained',
            fieldName,
            fieldOfIndex,
            format: item.format,
          });
        }
      }
      state.stacks.push(serializedStack);
    }

    return state;
  }

  // Stringified JSON version of state, with only cards that have been saved, used for the query param
  serialize(): string {
    return JSON.stringify(this.rawStateWithSavedCardsOnly());
  }

  // Deserialize a stringified JSON version of OperatorModeState into a Glimmer tracked object
  // so that templates can react to changes in stacks and their items
  async deserialize(rawState: SerializedState): Promise<OperatorModeState> {
    let newState: OperatorModeState = new TrackedObject({
      stacks: [],
    });

    let stackIndex = 0;
    for (let stack of rawState.stacks) {
      let newStack: Stack = { items: new TrackedArray([]) };
      for (let item of stack.items) {
        let { format } = item;
        if (item.type === 'card') {
          let card = await this.cardService.loadModel(new URL(item.id));
          newStack.items.push({
            type: 'card',
            card,
            format,
            stackIndex,
          });
        } else {
          let { fieldName, fieldOfIndex } = item;
          newStack.items.push({
            type: 'contained',
            fieldName,
            fieldOfIndex,
            format,
            stackIndex,
          });
        }
      }
      newState.stacks.push(newStack);
      stackIndex++;
    }

    return newState;
  }

  async constructRecentCards() {
    const recentCardIdsString = localStorage.getItem('recent-cards');
    if (!recentCardIdsString) {
      return;
    }

    const recentCardIds = JSON.parse(recentCardIdsString) as string[];
    for (const recentCardId of recentCardIds) {
      const card = await this.cardService.loadModel(new URL(recentCardId));
      this.recentCards.push(card);
    }
  }

  addRecentCards(card: Card) {
    const existingCardIndex = this.recentCards.findIndex(
      (recentCard) => recentCard.id === card.id
    );
    if (existingCardIndex !== -1) {
      this.recentCards.splice(existingCardIndex, 1);
    }

    this.recentCards.push(card);
    if (this.recentCards.length > 10) {
      this.recentCards.splice(0, 1);
    }
    const recentCardIds = this.recentCards
      .map((recentCard) => recentCard.id)
      .filter(Boolean); // don't include cards that don't have an ID
    localStorage.setItem('recent-cards', JSON.stringify(recentCardIds));
  }
}
