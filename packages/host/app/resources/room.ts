import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import { restartableTask } from 'ember-concurrency';
import { Resource } from 'ember-resources';

import type { RoomField } from 'https://cardstack.com/base/room';

import type MatrixService from '../services/matrix-service';

interface Args {
  named: {
    roomId: string | undefined;
  };
}

export class RoomResource extends Resource<Args> {
  @tracked room: RoomField | undefined;
  @tracked loading: Promise<void> | undefined;
  @service private declare matrixService: MatrixService;

  modify(_positional: never[], named: Args['named']) {
    this.loading = this.load.perform(named.roomId);
  }

  private load = restartableTask(async (roomId: string | undefined) => {
    console.log('about to try to load room ' + roomId);
    console.log(`these rooms exist?`, [...this.matrixService.rooms.keys()]);
    this.room = roomId ? await this.matrixService.rooms.get(roomId) : undefined;
    console.log('done, did we get a room?', this.room);
  });
}

export function getRoom(parent: object, roomId: () => string | undefined) {
  return RoomResource.from(parent, () => ({
    named: {
      roomId: roomId(),
    },
  }));
}
