var url = location.port === '8888' ? '/proxy' : 'http://cgstats.proxy.magusgeek.com';

angular.module('cgstats', ['ui.router'])

.config(function($stateProvider, $urlRouterProvider, $locationProvider) {
  $locationProvider.html5Mode(true)
  $urlRouterProvider.otherwise('/app');

  $stateProvider

  .state('app', {
    url: '/app',
    template: '<ui-view></ui-view>'
  })

  .state('app.stats', {
    url: '/{game}/{player}',
    templateUrl: '/templates/stats.html',
    controller: 'list'
  });
})

.controller('form', function($scope, $state, $rootScope) {
  $scope.player = '';
  $scope.game = '';

  $rootScope.$on('$stateChangeSuccess', function(event, toState, toParams) {
    if (toState.name == 'app.stats') {
      $scope.player = toParams.player;
      $scope.game = toParams.game;
    }
  });

  $scope.search = function() {
    if ($scope.game.trim() && $scope.player.trim()) {
      $state.go('app.stats', {
        game: $scope.game,
        player: $scope.player
      }, {
        reload: true
      });
    }
  };
})

.controller('list', function($scope, $http, $stateParams) {
  $scope.loading = true;

  $http.get(url + '/search?game=' + encodeURIComponent($stateParams.game.trim()) + '&player=' + encodeURIComponent($stateParams.player.trim()))

  .then(function (response) {
    $scope.fail = false;
    $scope.date = moment().format('HH:mm:ss');

    $scope.sortType = 'rank';
    $scope.sortReverse = false;
    
    $scope.player = response.data.player;
    $scope.stats = response.data.stats.stats || response.data.stats;
    $scope.details = response.data.stats.users;
    $scope.mode = response.data.mode;

    if ($scope.mode == 'optim') {
      $scope.score = 0;
      
      for (var i = 0; i < 5 && i < $scope.stats.length; ++i) {
        $scope.score += $scope.stats[i].points;
      }
    }
  })

  .catch(function() {
    $scope.fail = true;
  })

  .then(function() {
    $scope.loading = false;
  });
});