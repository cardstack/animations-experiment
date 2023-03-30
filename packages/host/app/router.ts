import EmberRouter from '@ember/routing/router';
import config from '@cardstack/host/config/environment';
const { ownRealmURL, hostsOwnAssets } = config;

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

let path = new URL(ownRealmURL).pathname.replace(/\/$/, '');

Router.map(function () {
  this.route('indexer', { path: '/indexer/:id' });
  if (!path || hostsOwnAssets) {
    this.route('code');
  } else {
    this.route('index', { path });
    this.route('code', { path: `${path}/code` });
  }
  this.route('card', { path: '/*path' });
});
