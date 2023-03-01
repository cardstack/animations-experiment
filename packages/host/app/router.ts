import EmberRouter from '@ember/routing/router';
import config from '@cardstack/host/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('code');
  this.route('indexer', { path: '/indexer/:id' });
  this.route('render-card', { path: '/*path' });
});
