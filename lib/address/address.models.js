const Joi = require('@hapi/joi');

module.exports = {
  db: (sequelize, DataTypes) => {
    const Address = sequelize.define('Address', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      source: DataTypes.ENUM('details', 'officers'),
      position: DataTypes.INTEGER,
      address: DataTypes.STRING,
      searchableAddressV1: DataTypes.STRING,
    });

    Address.associate = function (models) {
      models.Address.belongsTo(models.Corpsearch, {foreignKey: 'CorpId'});
      models.Corpsearch.hasMany(models.Address, {foreignKey: 'CorpId'});
    };

    return Address;
  },
};
