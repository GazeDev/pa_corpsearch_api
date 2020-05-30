const Joi = require('@hapi/joi');

module.exports = {
  db: (sequelize, DataTypes) => {
    const Corpsearch = sequelize.define('Corpsearch', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      name: DataTypes.STRING,
      namesHistory: {
        type: DataTypes.JSONB,
      },
      details: {
        type: DataTypes.JSONB,
      },
      officers: {
        type: DataTypes.JSONB,
      },
    });

    return Corpsearch;
  },
  apiFilterQuery: Joi.object().keys({
    name: [
      Joi.string().required(),
    ],
    type: [
      Joi.string().valid('starting', 'any', 'all', 'availability', 'sounds', 'exact'),
    ],
    activeOnly: [
      Joi.boolean(),
    ],
  }),
  apiEnumeration: Joi.object().keys({
    start: Joi.number().integer().min(1).required(),
    end: Joi.number().integer().greater(Joi.ref('start')).required(),
    // NOTE: min is what we want, but the swagger ui seems to have issues with it
    // end: Joi.number().integer().min(Joi.ref('start')).required(),
    queues: Joi.number().integer().min(1).required(),
  }),
  apiCorpsFilter: Joi.object().keys({
    start: Joi.number().integer().min(1).required(),
    end: Joi.number().integer().greater(Joi.ref('start')).required(),
    // NOTE: min is what we want, but the swagger ui seems to have issues with it
    // end: Joi.number().integer().min(Joi.ref('start')).required(),
  }),
};
