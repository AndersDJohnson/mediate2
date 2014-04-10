var express = require('express');
var params = require('express-params');
var connect = require('connect');
var _ = require('lodash');
var traverse = require('traverse');
var getobject = require('getobject');


var app = express();

app.use(connect.logger('tiny'));
app.use(connect.methodOverride());
app.use(connect.urlencoded());
app.use(connect.json());


var baseUrl = 'http://localhost:9090';

var db = require('./lib/db');

var resources = require('./stub/resources');


params.extend(app);

app.param('id', Number);


var parseSchema = function (schema, update) {
  schema = _.merge({}, schema);
  var paths = [];
  traverse(schema).forEach(function (value) {
    if (this.key === '$ref') {
      var updated = update(value, this.key);

      var path = this.path;
      path.slice().pop();
      var keypath = path.join('.');
      paths.push({
        key: this.key,
        keypath: keypath,
        path: path,
        updated: updated,
        value: value
      });
      this.update(updated)
    }
  });
  return {
    schema: schema,
    paths: paths
  };
};

var makeUrl = function (uri) {
  return baseUrl + uri;
};

_.each(resources, function (resource, name) {

  resource.uri = '/' + name;

  var makeResourceUri = function (uri) {
    uri = uri || '';
    return resource.uri + uri;
  };

  var makeResourceUrl = function (uri) {
    return makeUrl(makeResourceUri(uri));
  };

  var linkify = function (data) {
    var links = data.links;
    var items = data[data.type];
    _.each(links, function (link, keypath) {
      _.each(items, function (item) {
        var keypaths = keypath.slice().split('.');
        keypaths.shift(); // remove 'name'
        var subType = link.type;
        var propKeypath = keypaths.join('.');
        var value = getobject.get(item, propKeypath);
        var updated;
        var mapId = function (id) {
          return {
            id: id,
            href: makeUrl('/' + subType + '/' + id),
            type: subType
          };
        };
        if (_.isArray(value)) {
          updated = _.map(value, mapId);
        }
        else {
          updated = mapId(value);
        }
        getobject.set(item, propKeypath, updated);
      });
    });
  };

  var augment = function (data) {
    var augmented = {};
    augmented.type = name;
    augmented.href = makeResourceUrl();
    var parsedSchema = parseSchema(resource.schema, function (value, key) {
      return makeUrl('/' + value);
    });
    var links = {};
    _.each(parsedSchema.paths, function (path, key) {
      var keypaths = _.filter(path.path, function (val) {
        return val !== 'properties' && val !== '$ref';
      });
      var keypath = keypaths.join('.');
      var type = path.value;
      var namedKeypath = name + '.' + keypath;
      links[namedKeypath] = {
        href: path.updated + '/{' + name + '.' + keypath + '}',
        type: type
      };
    });
    augmented.links = links;
    augmented.schema = parsedSchema.schema;
    data = _.merge({}, data, augmented);
    linkify(data);
    return data;
  };

  app.get(makeResourceUri(), function (req, res, next) {
    var resData = {};
    db.get(name, function (err, data) {
      data = data.slice();
      _.each(data, function (item) {
        item.href = makeResourceUrl('/' + item.id);
      });
      resData[name] = data;
      resData = augment(resData);
      res.json(resData);
    });
  });

  app.get(makeResourceUri('/:id'), function (req, res, next) {
    var resData = {};
    var id = req.params.id;
    console.log('id', id);
    db.get(name, function (err, data) {
      // console.log('data', data);
      var item = _.where(data, {id: id});
      // console.log('item', item);
      resData[name] = item;
      resData = augment(resData);
      res.json(resData);
    });
  });

});


app.listen(9090);
