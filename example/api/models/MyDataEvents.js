module.exports = {

  connection: 'mongo',

  schema: true,

  autoUpdatedAt: false,
  autoCreatedAt: false,

  attributes: {
    entityId: {
      type: 'uuidv4',
      required: true,
      index: true
    },
    method: {
      type: 'string',
      required: true
    },
    data: {
      type: 'json',
      required: true
    },
    timestamp: {
      type: 'integer',
      required: true
    },
    version: {
      type: 'integer',
      required: true
    }
  }
};
