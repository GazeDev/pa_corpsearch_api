const Joi = require('@hapi/joi');

module.exports = {
  db: (sequelize, DataTypes) => {
    const Name = sequelize.define('Name', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      source: DataTypes.ENUM('namesHistory', 'officers'),
      position: DataTypes.INTEGER,
      name: DataTypes.STRING,
      searchableNameV1: DataTypes.STRING,
    });

    Name.associate = function (models) {
      models.Name.belongsTo(models.Corpsearch, {foreignKey: 'CorpId'});
      models.Corpsearch.hasMany(models.Name, {foreignKey: 'CorpId'});
    };

    return Name;
  },
};
