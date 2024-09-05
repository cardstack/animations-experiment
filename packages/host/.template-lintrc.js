'use strict';

module.exports = {
  extends: ['recommended', '@cardstack/template-lint:recommended'],
  plugins: ['../template-lint/plugin'],
  rules: {
    'require-button-type': false,
    'no-negated-condition': false,

    // https://github.com/ember-template-lint/ember-template-lint/issues/2785
    'no-implicit-this': false,

    // We need this to be able to use <style scoped> tags in our components for scoped CSS
    'no-forbidden-elements': ['meta', 'html', 'script'],
  },
};
