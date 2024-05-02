import { on } from '@ember/modifier';
import { action } from '@ember/object';
import { service } from '@ember/service';
import Component from '@glimmer/component';

import { RealmPaths } from '@cardstack/runtime-common';

import RealmIcon from '@cardstack/host/components/operator-mode/realm-icon';
import RealmInfoProvider from '@cardstack/host/components/operator-mode/realm-info-provider';
import { RecentFile } from '@cardstack/host/services/recent-files-service';

import type CardService from '../../services/card-service';
import type OperatorModeStateService from '../../services/operator-mode-state-service';
import type RecentFilesService from '../../services/recent-files-service';

interface Args {
  Args: {};
}

export default class RecentFiles extends Component<Args> {
  @service declare cardService: CardService;
  @service declare recentFilesService: RecentFilesService;
  @service declare operatorModeStateService: OperatorModeStateService;

  <template>
    <ul class='recent-files' data-test-recent-files>
      {{#each this.recentFilesService.recentFiles as |file|}}
        <File @recentFile={{file}} />
      {{/each}}
    </ul>
    <style>
      .recent-files {
        list-style-type: none;
        margin: 0;
        padding: 0;
      }
    </style>
  </template>
}

interface FileArgs {
  Args: {
    recentFile: RecentFile;
  };
}

class File extends Component<FileArgs> {
  @service declare cardService: CardService;
  @service declare operatorModeStateService: OperatorModeStateService;

  @action
  openFile() {
    this.operatorModeStateService.updateCodePath(new URL(this.fullUrl));
  }

  get realmPaths() {
    return new RealmPaths(this.args.recentFile.realmURL);
  }

  get fullUrl() {
    return new URL(
      `${this.args.recentFile.realmURL}${this.args.recentFile.filePath}`,
    );
  }

  get isSelected() {
    return (
      this.operatorModeStateService.state.codePath?.href === this.fullUrl.href
    );
  }

  <template>
    {{#unless this.isSelected}}
      {{! RealmInfoProvider and :ready do not produce children elements }}
      {{! template-lint-disable require-presentational-children }}
      <li
        class='recent-file'
        data-test-recent-file={{this.fullUrl.href}}
        role='button'
        {{on 'click' this.openFile}}
      >
        <RealmInfoProvider @realmURL={{@recentFile.realmURL}}>
          <:ready as |realmInfo|>
            <RealmIcon
              @realmIconURL={{realmInfo.iconURL}}
              @realmName={{realmInfo.name}}
              class='icon'
            />
          </:ready>
        </RealmInfoProvider>
        {{@recentFile.filePath}}
      </li>
    {{/unless}}
    <style>
      .recent-file {
        background: var(--boxel-light);
        padding: var(--boxel-sp-xs);
        font-weight: 700;
        margin-bottom: var(--boxel-sp-xs);
        border-radius: var(--boxel-border-radius);
        display: flex;
        align-items: center;
        overflow-wrap: anywhere;
        overflow: hidden;
      }

      .icon {
        width: 20px;
        height: 20px;
        margin-right: var(--boxel-sp-xxxs);
      }
    </style>
  </template>
}
