var url = location.port === '8888' ? '/proxy' : 'http://cgstats.proxy.magusgeek.com';

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
    if ($scope.game.trim() && $scope.player.trim()) {
      $scope.loading = true;

      $http.get(url + '/search?game=' + encodeURIComponent($scope.game.trim()) + '&player=' + encodeURIComponent($scope.player.trim()))

      .then(function (response) {
        data.set(response.data);
        $scope.fail = false;
        $scope.date = moment().format('HH:mm:ss');
      })

      .catch(function() {
        $scope.fail = true;
      })

      .then(function() {
        $scope.loading = false;
      });
    }
  };
})

.controller('list', function($scope, data) {
  $scope.sortType = 'rank';
  $scope.sortReverse = false;
  
  data.onChange(function(response) {
    $scope.player = response.player;
    $scope.stats = response.stats.stats || response.stats;
    $scope.details = response.stats.users;
    $scope.mode = response.mode;

    if ($scope.mode == 'optim') {
      $scope.score = 0;
      
      for (var i = 0; i < 5 && i < $scope.stats.length; ++i) {
        $scope.score += $scope.stats[i].points;
      }
    }
  });
});