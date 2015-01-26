module.exports = {

  connection: 'redis',

  autoPK: false,

  autoUpdateAt: false,
  autoCreatedAt: false,

  schema: false,

  attributes: {
    id: {
      type: 'uuidv4',
      required: true,
      primaryKey: true
    }
  }
};
