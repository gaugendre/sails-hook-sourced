module.exports = {

  connection: 'mongo',

  schema: false,

  autoCreatedAt: false,
  autoUpdatedAt: false,

  attributes: {
    entityId: {
      type: 'uuidv4',
      required: true,
      index: true
    },
    timestamp: {
      type: 'integer',
      required: true
    },
    snapshotVersion: {
      type: 'integer',
      required: true,
      index: true
    }
  }
};
