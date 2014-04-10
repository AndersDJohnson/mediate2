var data = require('../stub/data');

var db = module.exports = {};

db.get = function (name, callback) {
  callback(null, data[name]);
};
