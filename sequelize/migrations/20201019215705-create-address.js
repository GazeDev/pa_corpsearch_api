'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Addresses', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID
      },
      CorpId: {
        type: Sequelize.INTEGER,
        references: { model: 'Corps', key: 'id' }
      },
      source: {
        type: Sequelize.ENUM('details', 'officers')
      },
      position: {
        type: Sequelize.INTEGER
      },
      address: {
        type: Sequelize.STRING
      },
      searchableAddressV1: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Addresses');
  }
};
