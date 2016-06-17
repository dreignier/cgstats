// var url = 'http://cgstats.proxy.magusgeek.com';
var url = '/proxy';

angular.module('cgstats', [])

.factory('data', function() {
  var callback;

  return {
    onChange : function(fn) {
      callback = fn;
    },

    set : function(data) {
      callback(data);
    }
  };
})

.controller('form', function($scope, $http, data) {
  $scope.player = '';
  $scope.game = '';

  $scope.search = function() {
    $scope.loading = true;

    if ($scope.game.trim() && $scope.player.trim()) {
      $http.get(url + '/search?game=' + encodeURIComponent($scope.game.trim()) + '&player=' + encodeURIComponent($scope.player.trim())).then(function (response) {
        data.set(response.data);
        $scope.fail = false;
        $scope.date = moment().format('HH:mm:ss');
      }, function(response) {
        $scope.fail = true;
      }).then(function() {
        $scope.loading = false;
      });
    }
  };
})

.controller('list', function($scope, data) {
  data.onChange(function(response) {
    $scope.player = response.player;
    $scope.stats = response.stats.stats || response.stats;
    $scope.details = response.stats.details;
    $scope.mode = response.mode;

    if ($scope.mode == 'optim') {
      $scope.score = 0;
      
      for (var i = 0; i < 5 && i < $scope.stats.length; ++i) {
        $scope.score += $scope.stats[i].points;
      }
    }
  });
});