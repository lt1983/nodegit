var git = require('../'),
    events = require('events');

var Tree = function(rawObject, tree) {
  var self = {};

  if (rawObject instanceof git.raw.Repo &&
      tree instanceof git.raw.Tree) {
    self.repo = rawObject;
    self.tree = tree;
  } else if(rawObject instanceof git.raw.Repo) {
    self.repo = rawObject;
    self.tree = new git.raw.Tree(tree);
  } else if (rawObject instanceof git.raw.Tree) {
    self.tree = rawObject;
  } else {
    self.tree = new git.raw.Tree();
  }

  Object.defineProperty(self, 'length', {
    get: function() {
      return self.tree.entryCount();
    },
    enumerable: true
  });

  self.walk = function(repo) {
    repo = repo || self.repo;

    var entry,
        index,
        length = self.length,
        event = new events.EventEmitter(),
        entries = [];

    function next(index) {
      var dir;
      var tree;
      var prerequisites = 0;

      function complete(error) {
        if (index < length-1) {
          next(index = index+1);
        } else {
          event.emit('end', error, entries);
        }
      }

      entry = git.entry(repo);

      self.tree.entryByIndex(entry.entry, index, function() {
        if (entry.isFile()) {
          entries.push(entry);
          event.emit('entry', null, index, entry);
        } else {
          dir = entry.name;
          tree = entry.tree();
          prerequisites++;
          if (tree.error) {
            event.emit('end', tree.error);
            return;
          }

          tree.walk(repo).on('entry', function(error, index, entry) {
            if (error) {
              event.emit('entry', error, index, entry);
            }
            entry.dir = dir + '/' + entry.dir;
            event.emit('entry', null, index, entry);
          }).on('end', function(error, endEntries) {
            if (error) {
              complete(error);
            }
            prerequisites--;
            entries = entries.concat(endEntries);
            if (prerequisites === 0) {
              complete(error);
            }
          });
        }

        if (prerequisites === 0) {
          complete();
        }
      });
    }

    next(0);

    return event;
  };

  self.entry = function(path, callback) {
    if(!callback) {
      throw new Error('Tree entry function requires a callback');
    }

    self.tree.entryByPath(path, function(error, entry) {
      if (error) {
        callback(git.error(error), null);
      } else {
        git.entry(entry).fetchDetails(callback);
      }
    });
  };

  return self;
};

exports.tree = Tree;