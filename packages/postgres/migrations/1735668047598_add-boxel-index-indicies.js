exports.up = (pgm) => {
  pgm.createIndex('boxel_index', 'type');
  pgm.createIndex('boxel_index', ['url', 'realm_version']);
  pgm.createIndex('boxel_index', 'deps', { method: 'gin' });
  pgm.createIndex('boxel_index', 'types', { method: 'gin' });
  pgm.createIndex('boxel_index', 'fitted_html', { method: 'gin' });
  pgm.createIndex('boxel_index', 'embedded_html', { method: 'gin' });
  pgm.createIndex('boxel_index', 'search_doc', { method: 'gin' });
};

exports.down = (pgm) => {
  pgm.dropIndex('boxel_index', 'type');
  pgm.dropIndex('boxel_index', ['url', 'realm_version']);
  pgm.dropIndex('boxel_index', 'deps');
  pgm.dropIndex('boxel_index', 'types');
  pgm.dropIndex('boxel_index', 'fitted_html');
  pgm.dropIndex('boxel_index', 'embedded_html');
  pgm.dropIndex('boxel_index', 'search_doc');
};
