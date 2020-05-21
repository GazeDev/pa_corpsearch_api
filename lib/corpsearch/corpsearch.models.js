const Joi = require('@hapi/joi');

module.exports = {
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
};
