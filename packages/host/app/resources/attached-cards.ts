import { Resource } from 'ember-resources';
import { tracked } from '@glimmer/tracking';
import { restartableTask, all } from 'ember-concurrency';
import { service } from '@ember/service';
import type CardService from '../services/card-service';
import { type RoomField } from 'https://cardstack.com/base/room';
import type { CardDef } from 'https://cardstack.com/base/card-api';

interface Args {
  named: { room: RoomField | undefined; ids: string[] };
}

export class AttachedCards extends Resource<Args> {
  @service declare cardService: CardService;
  @tracked instances: CardDef[] = [];

  modify(_positional: never[], named: Args['named']) {
    let { room, ids } = named;
    this.load.perform(room, ids);
  }

  private load = restartableTask(
    async (room: RoomField | undefined, ids: string[]) => {
      if (!room) {
        this.instances = [];
        return;
      }
      let RoomFieldClazz = Reflect.getPrototypeOf(room)!
        .constructor as typeof RoomField;
      let pendingCards: Promise<CardDef>[] = [];
      for (let id of ids) {
        let pendingCard = RoomFieldClazz.getAttachedCard(id);
        if (!pendingCard) {
          pendingCard = this.cardService.loadModel(new URL(id));
          RoomFieldClazz.setAttachedCard(id, pendingCard);
        }
        pendingCards.push(pendingCard);
      }
      this.instances = await all(pendingCards);
    },
  );
}

export function getAttachedCards(
  parent: object,
  room: () => RoomField | undefined,
  ids: () => string[],
) {
  return AttachedCards.from(parent, () => ({
    named: {
      room: room(),
      ids: ids(),
    },
  })) as AttachedCards;
}
