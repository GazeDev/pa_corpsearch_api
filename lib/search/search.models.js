const Joi = require('@hapi/joi');

module.exports = {
  db: (sequelize, DataTypes) => {
    const Search = sequelize.define('Search', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      query: {
        type: DataTypes.JSONB,
      },
      queues: {
        type: DataTypes.JSONB,
      },
    });

    return Search;
  },
  searchId: Joi.object().keys({
    searchId: Joi.string().guid().required(),
  }),
};
