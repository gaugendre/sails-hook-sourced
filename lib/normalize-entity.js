/**
 * Module dependencies
 */

var util = require('util');
var _ = require('sails/node_modules/lodash');

var Entity = require('sourced').Entity;
var defaultEntityDef = require('./entity-defaults.js');

module.exports = function howto_normalizeEntityDefinition (sails) {

  return function normalizeEntityDefinition (entityDef, entityID) {

    var newEntityDef = function() {
      this.id = null;
      Entity.apply(this, arguments);
    };

    util.inherits(newEntityDef, Entity);

    _.merge(newEntityDef.prototype, defaultEntityDef(entityDef.globalId), entityDef);

    return newEntityDef;

  };
};
