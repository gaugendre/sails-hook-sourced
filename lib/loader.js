module.exports = function howto_lookupUserEntities(sails) {

  return function lookupUserEntities(next) {

    sails.log.verbose('Loading sourced entities...');

    sails.hooks.moduleloader.optional({
      dirname: sails.config.paths.entities,
      filter: /(.+)Entity\.(js|coffee|litcoffee)$/,
      flattenDirectories: true,
      keepDirectoryPath: true,
      replaceExpr: /Entity/
    }, next);

  };

};
