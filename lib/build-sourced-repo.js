var _ = require('sails/node_modules/lodash');
var Repository = require('./repository');

module.exports = function howto_buildSourcedRepo(sails) {
  return function buildSourcedRepo(entityDefs, cb) {

    sails.log.verbose('Starting SourcedRepo...');

    sails.sourced = {};

    _.each(entityDefs, function(entityDef, entityID) {
      sails.log.silly('Registering entity `' + entityID + '` as SourcedRepo');

      var options = entityDef.prototype.options;

      var EventModel = global[options.models.events] || sails.models[options.models.events.toLowerCase()];
      var SnapshotModel = global[options.models.snapshots] || sails.models[options.models.snapshots.toLowerCase()];
      var CacheModel = options.models.cache ? global[options.models.cache] || sails.models[options.models.cache.toLowerCase()] : undefined;

      sails.sourced[entityID] = Repository(entityDef, EventModel, SnapshotModel, CacheModel);
    });

    if (sails.config.globals && sails.config.globals.models) {
      _.each(sails.sourced, function(repo, entityID) {
        var globalName = repo.globalId || repo.identity;

        sails.log.silly('Set SourcedRepo `' + globalName + '` as global');

        if (typeof global[globalName] !== 'undefined') {
          sails.log.warn('globalName `' + globalName + '` already taken! Access your SourcedRepo from `sails.sourced[\'' + entityID + '\']` instead.');
        } else {
          global[globalName] = repo;
        }
      });
    }

    cb();
  };
};
