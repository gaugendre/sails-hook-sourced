var path = require('path');
var _ = require('sails/node_modules/lodash');

var howto_loadEntities = require('./loader');
var howto_normalizeEntityDef = require('./normalize-entity');
var howto_buildSourcedRepo = require('./build-sourced-repo');

module.exports = function(sails) {
  var loadEntities = howto_loadEntities(sails);
  var normalizeEntityDef = howto_normalizeEntityDef(sails);
  var buildSourcedRepo = howto_buildSourcedRepo(sails);

  return {

    defaults: function(config) {
      return {
        paths: {
          entities: path.resolve(config.appPath, 'api/entities')
        }
      };
    },

    configure: function() {
      _.extend(sails.config.paths, {
        entities: path.resolve(sails.config.appPath, sails.config.paths.entities)
      });
    },

    initialize: function(cb) {

      sails.after('hook:orm:loaded', function() {

        loadEntities(function(err, modules) {
          if (err) return cb(err);

          _.each(modules, function(entity, identity) {
            modules[identity] = normalizeEntityDef(entity, identity);
          });

          buildSourcedRepo(modules, cb);
        });

      });

    }

  };
};
