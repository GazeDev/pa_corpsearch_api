'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Names', {
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
        type: Sequelize.ENUM('nameHistory', 'officers')
      },
      position: {
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      searchableNameV1: {
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
    return queryInterface.dropTable('Names');
  }
};
