const Joi = require('@hapi/joi');

module.exports = {
  apiTabsId: Joi.object().keys({
    tabId: Joi.string().required(),
  })
};
