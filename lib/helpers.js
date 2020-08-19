const Boom = require('@hapi/boom');
module.exports = {
  ensureAdmin: async function(request) {
    if (
      // if SUPER_ADMIN is undefined or empty
      !process.env.SUPER_ADMIN ||
      request.auth.credentials.subjectId !== process.env.SUPER_ADMIN
    ) {
      throw Boom.forbidden('Must be an Admin');
    }
    return true;
  },
};
