var _ = require('sails/node_modules/lodash');

function _extend(entity, data, method, enqueue, cb) {
  _.extend(entity, data);
  entity.digest(method, data);
  entity.enqueue(enqueue, data);
  if (cb) cb();
}

module.exports = {
  options: {
    indices: ['id', 'version'],
    models: {
      events: 'MyDataEvents',
      snapshots: 'MyDataSnapshots',
      cache: 'MyDataCache'
    },
    attributes: []
  },

  initialize: function(id, cb) {
    this.id = id;
    if (cb) cb();
  },

  create: function(data, cb) {
    _extend(this, data, 'create', this.identity + '.created', cb);
  },

  update: function(data, cb) {
    _extend(this, data, 'update', this.identity + '.updated', cb);
  },

  replace: function(data, cb) {
    var self = this;

    self.options.attributes.forEach(function(val, key) {
      delete self[key];
    });

    _extend(this, data, 'replace', this.identity + '.replaced', cb);
  },

  delete: function(data, cb) {
    this.deleted = true;

    _extend(this, {
      deleted: true
    }, 'delete', this.identity + '.deleted', cb);
  },

  restore: function(data, cb) {
    this.deleted = false;

    _extend(this, {
      deleted: false
    }, 'restore', this.identity + '.restored', cb);
  }
};
