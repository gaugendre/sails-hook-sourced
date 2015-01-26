/**
 * All of the code and interface naming is inspired by Matt Walters' module
 * [sourced-repo-mongo](https://github.com/mateodelnorte/sourced-repo-mongo)
 */

var _ = require('sails/node_modules/lodash');
var async = require('sails/node_modules/async');

module.exports = function(Entity, EventModel, SnapshotModel, CacheModel) {

  var _getIdVersionPairsBasic = function(ids, next) {
    async.map(ids, function(id, next) {
      SnapshotModel.findOneByEntityId(id).sort('snapshotVersion DESC').exec(next);
    }, next);
  };

  var _getIdVersionPairsMongo = function(ids, next) {
    SnapshotModel.native(function(collection) {
      collection.aggregate([{
        $match: {
          entityId: {
            $in: ids
          }
        }
      }, {
        $group: {
          entityId: '$entityId',
          snapshotVersion: {
            $last: '$snapshotVersion'
          }
        }
      }], next);
    });
  };

  var _getIdVersionPairsSQL = function(ids, next) {
    /// TODO
    /// SELECT DISTINCT `entityId`, MAX(`snapshotVersion`) as `snapshotVersion` FROM `snapshots` WHERE `entityId` IN ('id1', 'id2') GROUP BY `entityId`
    /// var query = '';
    /// SnapshotModel.query(query)
  };

  var _getIdVersionPairsMySQL = function(ids, next) {
    SnapshotModel.find({
      entityId: ids,
      groupBy: 'entityId',
      max: 'snapshotVersion'
    }).exec(next);
  };

  /// TODO
  /// test and optimize against popular adapters
  var _getIdVersionPairs = SnapshotModel.adapter.dictionary.identity === 'mongo' ? _getIdVersionPairsMongo : _getIdVersionPairsBasic;

  var repository = {

    identity: Entity.prototype.identity,

    globalId: Entity.prototype.globalId,

    events: EventModel,

    snapshots: SnapshotModel,

    cache: CacheModel,

    get: CacheModel ? _getFromCache : _get,

    commit: _commit,

    getAll: _getAll,

    commitAll: _commitAll,

    /**
     * Wrapper to get entity from cache and apply related event to the repository
     *
     * @param  {string}   eventName   function name as desined in the entity definition
     * @param  {Object}   data        event payload, containing event.id as the entity uuid
     * @param  {Function} before      provide the instanciated entity afted gatting from cache or store: function(entity, callback)
     * @param  {Function} next        callback: function(err)
     * @return {void}
     */
    play: function(eventName, data, before, next) {
      var self = this;

      if (typeof data.id === 'undefined') {
        return next('data has no id');
      }

      self.get(data.id, function(err, entity) {
        if (err) return next(err);

        function after() {
          if (typeof entity[eventName] === 'undefined') {
            return next(eventName + ' does not exists');
          }

          entity[eventName](data, function(err) {
            if (err) return next(err);

            self.commit(entity, function(err) {
              if (err) return next(err);

              if (CacheModel) return _setCache(entity, next);

              next();
            });
          });
        }

        if (before) return before(entity, after);

        after();
      });
    }
  };

  function _get(id, next) {
    SnapshotModel
      .findOneByEntityId(id)
      .sort('snapshotVersion DESC')
      .exec(function(err, snapshot) {

        if (err) return next(err);

        var criterias = (snapshot) ? {
          entityId: id,
          version: {
            '>': snapshot.version
          }
        } : {
          entityId: id
        };

        EventModel
          .find(criterias)
          .sort('version')
          .exec(function(err, events) {

            if (err) return next(err);

            if (snapshot) {
              snapshot.id = snapshot.entityId;
              delete snapshot.entityId;
            }

            next(null, _deserialize(id, snapshot, events));
          });
      });
  }

  function _commit(entity, next) {
    async.series([

      function(next) {
        _commitEvents(entity, next);
      },

      function(next) {
        _commitSnapshots(entity, next);
      },

      function(next) {
        _emitEvents(entity, next);
      },

    ], next);
  }

  function _getAll(ids, next) {
    _getAllSnapshots(ids, function(err, snapshots) {
      if (err) return next(err);

      _getAllEvents(ids, snapshots, next);
    });
  }

  function _commitAll(entities, next) {
    async.series([

      function(next) {
        _commitAllEvents(entities, next);
      },

      function(next) {
        _commitAllSnapshots(entities, next);
      }

    ], function(err) {
      if (err) return next(err);

      async.each(entities, _emitEvents, next);
    });
  }

  function _getFromCache(id, next) {
    CacheModel.findOne(id).exec(function(err, cache) {
      if (err) return next(err);

      if (!cache) {
        _get(id, function(err, entity) {
          if (err) return next(err);

          CacheModel.create(entity).exec(next);
        });
      } else {
        next(null, _deserialize(id, cache));
      }
    });
  }

  function _setCache(entity, next) {
    CacheModel.update(entity.id, entity).exec(function(err, updatedEntity) {
      if (err) return next(err);

      if (!updatedEntity) return CacheModel.create(entity).exec(next);

      next();
    });
  }

  function _getAllEvents(ids, snapshots, next) {
    var criteria = {
      or: []
    };

    ids.forEach(function(id) {
      var snapshot;
      if (!(snapshot = _.find(snapshots, function(snapshot) {
        return id === snapshot.id;
      }))) {
        criteria.or.push({
          id: id
        });
      } else {
        criteria.or.push({
          id: snapshot.id,
          version: {
            '>': snapshot.snapshotVersion
          }
        });
      }
    });

    EventModel.find(criteria)
      .sort('id, version')
      .exec(function(err, events) {
        if (err) return next(err);

        var results = [];

        ids.forEach(function(id) {
          var snapshot = _.find(snapshots, function(snapshot) {
            return snapshot.id === id;
          });

          if (snapshot) delete snapshot._id;

          var evnts = _.filter(events, function(event) {
            return event.id === id;
          });

          var entity = self._deserialize(id, snapshot, evnts);
          results.push(entity);
        });

        return next(null, results);
      });
  }

  function _getAllSnapshots(ids, next) {
    _getIdVersionPairs(function(err, idVersionPairs) {
      if (err) return next(err);

      var criteria = {};

      if (idVersionPairs.length === 0) {
        return next(null, []);
      } else if (idVersionPairs.length === 1) {
        criteria = {
          entityId: idVersionPairs[0].entityId
        };
      } else {
        criteria.or = [];

        idVersionPairs.forEach(function(pair) {
          var cri = {
            entityId: pair.entityId,
            snapshotVersion: pair.snapshotVersion
          };
          criteria.or.push(cri);
        });
      }

      SnapshotModel
        .find(criteria)
        .exec(function(err, snapshots) {
          if (err) next(err);
          next(snapshots);
        });
    });
  }

  function _commitEvents(entity, next) {
    if (entity.newEvents.length === 0) return next();

    var events = entity.newEvents;

    events.forEach(function(event) {
      if (entity.indices) {
        entity.indices.forEach(function(index) {
          event[index] = entity[index];
        });
      }

      if (event && event.id) {
        event.entityId = event.id;
        delete event.id;
      } else if (event && entity.id) {
        event.entityId = entity.id;
      }
    });

    EventModel.createEach(events).exec(function(err) {
      if (err) return next(err);

      entity.newEvents = [];
      return next();
    });
  }

  function _commitAllEvents(entities, next) {
    var events = [];

    entities.forEach(function(entity) {
      if (entity.newEvents.length === 0) return;

      var evnts = entity.newEvents;

      evnts.forEach(function _applyIndices(event) {
        if (entity.indices) {
          entity.indices.forEach(function(index) {
            event[index] = entity[index];
          });
        }

        if (event && event.id) {
          event.entityId = event.id;
          delete event.id;
        }
      });

      Array.prototype.unshift.apply(events, evnts);
    });

    if (events.length === 0) return next();

    EventModel.createEach(events).exec(function(err) {
      if (err) return next(err);

      entities.forEach(function(entity) {
        entity.newEvents = [];
      });

      next();
    });
  }

  function _commitSnapshots(entity, next) {
    if (entity.version >= entity.snapshotVersion + 10) {
      var snapshot = entity.snapshot();
      if (snapshot && snapshot.id) {
        snapshot.entityId = snapshot.id;
        delete snapshot.id;
      }
      SnapshotModel.create(snapshot).exec(next);
    } else {
      next(null, entity);
    }
  }

  function _commitAllSnapshots(entities, next) {
    var snapshots = [];

    entities.forEach(function(entity) {
      if (entity.version >= entity.snapshotVersion + 10) {
        var snapshot = entity.snapshot();
        if (snapshot) {
          if (snapshot.id) {
            snapshot.entityId = snapshot.id;
            delete snapshot.id;
          }
          snapshots.push(snapshot);
        }
      }
    });

    if (snapshots.length === 0) return next();

    SnapshotModel.createEach(snapshots).exec(next);
  }

  function _deserialize(id, snapshot, events) {
    var entity = new Entity(snapshot, events);
    entity.id = id;
    return entity;
  }

  function _emitEvents(entity, cb) {
    var eventsToEmit = entity.eventsToEmit;
    entity.eventsToEmit = [];

    eventsToEmit.forEach(function(eventToEmit) {
      var args = Array.prototype.slice.call(eventToEmit);
      Entity.prototype.emit.apply(entity, args);
    });

    if (cb) cb();
  }

  return repository;
};
