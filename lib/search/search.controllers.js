module.exports = (models) => {
  return {
    getSearches: function(request, h) {
      try {
        return models.Search.findAll({
          order: [['createdAt', 'DESC']]
        });
      } catch (e) {
        console.log('error', e);
        throw "Request Failed";
      }
    },
  }

};
