const queries = require('./queries');
const mutations = require('./mutations');
const activities = require('./activities');
const stock = require('./stock');

module.exports = {
  ...queries,
  ...mutations,
  ...activities,
  ...stock
};