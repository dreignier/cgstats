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

.controller('list', function($scope, $http, $stateParams, $timeout) {
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
    $scope.game = $stateParams.game;

    if ($scope.mode == 'optim') {
      $scope.score = 0;

      for (var i = 0; i < 5 && i < $scope.stats.length; ++i) {
        $scope.score += $scope.stats[i].points;
      }
    }

    $scope.csv = 'Rank;Nick;Score;Winrate;WinrateErrorDown;WinrateErrorUp;Wins;Loses;Draws;Total\n';
    $scope.csv += $scope.details

    .filter(function(line) {
      return line.pseudo !== $scope.player.pseudo;
    })

    .sort(function(a, b) {
      return a.rank > b.rank ? +1 : -1;
    })

    .map(function(line) {
      return [line.rank, line.pseudo, line.score, line.winrate, line.winrateErrorDown, line.winrateErrorUp, line.beaten, line.lose, line.draw, line.total].join(';');
    }).join('\n');

    $timeout(function() {
      window.scrollTo(0, document.getElementById('search-time').getBoundingClientRect().top);
    }, 1, false);
  })

  .catch(function() {
    $scope.fail = true;
  })

  .then(function() {
    $scope.loading = false;
  });
});