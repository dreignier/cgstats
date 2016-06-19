var url = location.port === '8888' ? '/proxy' : 'http://cgstats.proxy.magusgeek.com';

angular.module('cgstats', ['ui.router'])

.config(function($stateProvider, $urlRouterProvider, $locationProvider) {
  $locationProvider.html5Mode(true)
  $urlRouterProvider.otherwise('/app');

  $stateProvider

  .state('app', {
    url: '/app'
  })

  .state('app.stats', {
    url: '/{game}/{player}',
    templateUrl: '/templates/stats.html',
    controller: 'list'
  });
})

.factory('data', function() {
  var callback;

  return {

  };
})

.controller('form', function($scope, $http, $state, data) {
  $scope.player = '';
  $scope.game = '';

  $scope.search = function() {
    if ($scope.game.trim() && $scope.player.trim()) {
      $scope.loading = true;

      $http.get(url + '/search?game=' + encodeURIComponent($scope.game.trim()) + '&player=' + encodeURIComponent($scope.player.trim()))

      .then(function (response) {
        data.data = response.data;
        
        $scope.fail = false;
        $scope.date = moment().format('HH:mm:ss');

        $state.go('app.stats', {
          game: $scope.game,
          player: $scope.player
        });
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
  console.log('mais prout ?');
  $scope.sortType = 'rank';
  $scope.sortReverse = false;
  
  $scope.player = data.data.player;
  $scope.stats = data.data.stats.stats || data.data.stats;
  $scope.details = data.data.stats.users;
  $scope.mode = data.data.mode;

  if ($scope.mode == 'optim') {
    $scope.score = 0;
    
    for (var i = 0; i < 5 && i < $scope.stats.length; ++i) {
      $scope.score += $scope.stats[i].points;
    }
  }
});