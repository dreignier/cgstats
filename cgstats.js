// Les combats :
// https://www.codingame.com/services/gamesPlayersRankingRemoteService/findAllByTestSessionHandle
// POST : ["1068959f5d9ae270f02e0d29e8b27ea9e18c0f"] Id dans le json du leaderboard

// Classement challenge :
// https://www.codingame.com/services/LeaderboardsRemoteService/getChallengeLeaderboard
// ["59","1724dffd64c8c26c9fa9a189691387b5760508","global"]
//   id en dur
//   je ne sais pas
//   "global"



// https://www.codingame.com/services/LeaderboardsRemoteService/getChallengeLeaderboard

var express = require('express'),
    request = require('request'),
    _ = require('underscore'),
    jStat = require('jStat').jStat;

// ****************************

var optimizations = ["thor-codesize", "paranoid-codesize", "temperatures-codesize", "chuck-norris-codesize"];

// *****************************

var app = express();

// *****************************

app.get('/multi-list', function (req, res) {

  // First get the global puzzle list
  request({
    url: 'https://www.codingame.com/services/PuzzleRemoteService/findAllMinimalProgress',
    method: 'POST',
    json: true,
    body: [null]
  }, function (error, response, body) {

    if (error || !body || !body.success) {
      console.error('Error while retrieving multi IDs', body);
      res.status(500).end();
      return;
    }

    var multiIds = body.success
      .filter(e => e.level === "multi")
      .map(e => e.id);

    // Then get the details on every multi
    request({
      url: 'https://www.codingame.com/services/PuzzleRemoteService/findProgressByIds',
      method: 'POST',
      json: true,
      body: [multiIds, null, 1]
    }, function (error, response, body) {

      if (error || !body || !body.success) {
        console.error('Error while retrieving multi details', body);
        res.status(500).end();
        return;
      }

      res.type('json').set({
        'Access-Control-Allow-Origin': 'http://cgstats.magusgeek.com'
      }).send(JSON.stringify(body.success
        .sort((a, b) => (b.creationTime || b.date) - (a.creationTime || a.date))
        .map(function (c) {
          return {
            name: c.title,
            id: c.puzzleLeaderboardId
          }
        }))).end();
    });
  })
});

app.get('/contest-list', function (req, res) {

  request({
    url: 'https://www.codingame.com/services/ChallengeRemoteService/findAllChallenges',
    method: 'POST',
    json: true,
    body: []
  }, function (error, response, body) {

    if (error) {
      console.error(error);
      res.status(500).end();
      return;
    }

    if (!body || !body.success) {
      console.error('No success in body 1', body);
      res.status(500).end();
      return;
    }

    res.type('json').set({
      'Access-Control-Allow-Origin': 'http://cgstats.magusgeek.com'
    }).send(JSON.stringify(body.success
      .filter(c => c.level == "multi" || c.type == "BATTLE")
      .sort((a, b) => (b.creationTime || b.date) - (a.creationTime || a.date))
      .map(function (c) {
        return {
          name: c.title,
          id: c.publicId
        }
      }))).end();
  })
});

app.get('/search*', function(req, res) {

  var game = req.query.game,
      player = req.query.player
      countDraws = req.query.countDraws;

  if (!game || !player) {
    res.status(400).end();
    return;
  }

  if (optimizations.indexOf(game) != -1) {
    getStats('LeaderboardsRemoteService/getFilteredPuzzleLeaderboard',
      [game, , , {"active" : true, "column" : "keyword", "filter" : player}])
      .then(function (response) {
        var requests = response.users
          .filter(function(rank) {
            return (rank.pseudo || '').toLowerCase() == player.toLowerCase();
          })
          .map(function(rank) {
            return getStats('LeaderboardsRemoteService/getFilteredPuzzleLeaderboard',
              [game, , , {"active" : true, "column" : "LANGUAGE", "filter" : rank.programmingLanguage}]);
          });
        Promise.all(requests)
          .then(function(responses) {
            var users = responses.map(function(response) {
              return response.users;
            });
            return {users: users, programmingLanguages: response.programmingLanguages};
          })
          .then(function(response) {
            res.type('json').set({
              'Access-Control-Allow-Origin' : 'http://cgstats.magusgeek.com'
            }).send(JSON.stringify({
              player : player,
              stats : compileOptimizationStats(response, player),
              mode : 'optim'
            })).end();
          })
          .catch(function(error) {
            res.status(500).end();
          });
      })
      .catch(function(error) {
        res.status(500).end();
      });
  } else {
    var api = game.substring(0, 6) == 'multi-' ? 'getFilteredPuzzleLeaderboard' : 'getFilteredChallengeLeaderboard';

    game = game.replace('multi-', '');

    // Get the game leaderboard
    request({
      url : 'https://www.codingame.com/services/LeaderboardsRemoteService/' + api,
      method : 'POST',
      json : true,
      body : [game, undefined, 'global', { active: false, column: undefined, filter: undefined}]
    }, function(error, response, body) {

      if (error) {
        console.error(error);
        res.status(500).end();
        return;
      }

      if (!body || !body.success) {
        console.error('No success in body 1', body);
        res.status(500).end();
        return;
      }

      // Search for the player
      var user = null,
          users = {}; // only close users are considered (-10 +10)

      var userIdx = -1;
      for (var i = 0; i < body.success.users.length; ++i) {
        if (!user && body.success.users[i].pseudo && body.success.users[i].pseudo.toLowerCase() == player.toLowerCase()) {
          user = body.success.users[i];
          userIdx = i;
          break;
        }
      }

      for (var i = Math.max(0, userIdx - 20); i <= userIdx + 20 && i < body.success.users.length; i++) {
        // in 'classic' mode, players are indexed by their userId
        if (body.success.users[i].codingamer && body.success.users[i].codingamer.userId) {
          users[body.success.users[i].codingamer.userId] = body.success.users[i];
        }
      }

      if (!user) {
        res.status(404).end();
        return;
      }

      // Get the games
      request({
        url : 'https://www.codingame.com/services/gamesPlayersRankingRemoteService/findLastBattlesByAgentId',
        method : 'POST',
        json : true,
        body : [user.agentId, null]
      }, function(error, response, body) {

          if (error) {
            console.error(error);
            res.status(500).end();
            return;
          }

          if (!body || !body.success) {
            console.error('No success in body 2', body);
            res.status(500).end();
            return;
          }

          var bossGameId = -1;
          for (var i in body.success) {
            if (bossGameId != -1) break;
            var result = body.success[i];

            if (result.done && result.players.length >= 2) {
              for (var key in result.players) {
                if (result.players[key].userId == 0) {
                  bossGameId = result.gameId;
                  break;
                }
              }
            }
          }

          addBossInUsers(users, bossGameId).then(r => {
            res.type('json').set({
              'Access-Control-Allow-Origin' : 'http://cgstats.magusgeek.com'
            }).send(JSON.stringify({
              player : user,
              stats : compileStats(body.success, user.codingamer.userId, users, countDraws),
              mode : 'multi'
            })).end();
          });
      });
    });
  }
});

app.listen(9888);

// *****************************

function getStats(resource, parameters) {
  return new Promise(function(resolve, reject) {

    request({
      url: 'https://www.codingame.com/services/' + resource,
      method : 'POST',
      json : true,
      body : parameters,
    }, function(error, response, body) {
      if (error) {
        console.error(error);
        reject(error);
        return;
      }

      if (!body || !body.success) {
        console.error('No success in body', body);
        reject(new Error('No success in body'));
      }

      resolve(body.success);
    });
  });
}

function addBossInUsers(users, gameId) {
  return new Promise(function (resolve, reject) {
    if (gameId == -1) {
      resolve();
      return;
    }
    request({
      url: 'https://www.codingame.com/services/gameResultRemoteService/findByGameId',
      method: 'POST',
      json: true,
      body: [gameId, null]
    }, function (error, response, body) {
  
      if (error) { 
        reject();
        return;
      }
      if (!body || !body.success) { 
        reject("invalid response from server"); 
        return;
      }
  
      var bossAgent = null;
      for (var key in body.success.agents) {
        if (body.success.agents[key].hasOwnProperty('arenaboss')) {
          bossAgent = body.success.agents[key];
          break;
        }
      }
  
      if (bossAgent == null) {
        reject("cannot find boss data !");
        return;
      }
  
      users[0] = {
        isBoss : true,
        league : bossAgent.arenaboss.league,
        score : +bossAgent.score.toFixed(2),
        pseudo : bossAgent.arenaboss.nickname,
        draw : 0,
        lose : 0,
        beaten : 0,
        total : 0,
        winrate : 0,
        winrateErrorUp : 0,
        winrateErrorDown : 0,
        winrateErrorRange : 0
      }
  
      resolve();
    });
  });
}

function compileStats(data, myIdentifier, users, countDraws) {

  var stats = [[], [], []];
  for (var key in users) {
    users[key].draw = 0;
    users[key].lose = 0;
    users[key].beaten = 0;
    users[key].total = 0;
    users[key].winrate = 0;
    users[key].winrateErrorUp = 0;
    users[key].winrateErrorDown = 0;
    users[key].winrateErrorRange = 0;
  }

  // Global winrate stats
  data.forEach(function(result) {
    if (result.done && result.players.length >= 2) {

      if (result.players.length === 2 && result.players[0].position === result.players[1].position) {
        // It's a draw in a 1v1 game
        var hisId = result.players[0].userId === myIdentifier ? result.players[1].userId : result.players[0].userId;

        if (users[hisId]) {
          users[hisId].total++;
          users[hisId].draw++;
        }
      } else {
        var position;
        var found = false;

        for (var i = 0; i < result.players.length; ++i) {

          var hisId = result.players[i].userId;

          if (hisId == myIdentifier) {
            position = result.players[i].position;
          }

          if (hisId == myIdentifier) {
            found = true;
          } else if (users.hasOwnProperty(hisId)) {
            users[hisId].total++;
            if (found) {
              users[hisId].beaten++;
            } else {
              users[hisId].lose++;
            }
          }
        }

        stats[result.players.length - 2][position] = (stats[result.players.length - 2][position] || 0) + 1;
      }
    }
  });

  for (var i = stats.length - 1; i >= 0; --i) {
    var total = 0;

    for (var j = 0; j < stats[i].length; ++j) {
      total += stats[i][j];
    }

    var line = {
      total : total
    };

    for (var j = 0; j < stats[i].length; ++j) {
      line[j + 1] = {
        count : stats[i][j],
        percentage : Math.round(stats[i][j]*100/total)
      }
    }

    stats[(i + 2)] = line;
  }

  for (var key in users) {
    if (users[key].total > 0 && key != myIdentifier) {
      var numberOfGames;
      var victories;
      if (countDraws) {
        numberOfGames = users[key].total;
        victories = users[key].beaten + users[key].draw / 2;
      } else {
        numberOfGames = users[key].beaten + users[key].lose;
        victories = users[key].beaten
      }
      users[key].winrate = Math.round(victories * 100 / numberOfGames);

      var alpha = 0.05;
      users[key].winrateErrorUp = Math.round(100*(1 - jStat.beta.inv(alpha/2, numberOfGames - victories, victories + 1)));
      users[key].winrateErrorDown = Math.round(100*(1 - jStat.beta.inv(1 - alpha/2, numberOfGames - victories + 1, victories)));
      users[key].winrateErrorRange = users[key].winrateErrorUp - users[key].winrateErrorDown;
    }
  }

  users[myIdentifier].highlight = true;

  var usersArray = _.values(users);
  for (user of usersArray) {
    user.scoreKey = user.score + user.league.divisionIndex * 100;
  }

  var result = {
    stats: stats,
    users: usersArray
  };

  return result;
}

function compileOptimizationStats(data, player) {
  var result = [];

  data.users.forEach(function(ranks) {
    var index = ranks.findIndex(function (rank) {
      return (rank.pseudo || '').toLowerCase() == player.toLowerCase();
    });
    if (index === -1) return;

    var language = ranks[0].programmingLanguage;
    var total = data.programmingLanguages[language];

    result.push({
      language : language,
      rank : index + 1,
      total : total,
      codeSize: ranks[index].criteriaScore,
      lead: index + 1 < ranks.length ? ranks[index + 1].criteriaScore - ranks[index].criteriaScore : null,
      gap: index > 0 ? ranks[index].criteriaScore - ranks[index - 1].criteriaScore : null,
      points : Math.round(Math.pow(200, (total - index)/total))
    });
  });

  result.sort(function(a, b) {
    return a.points < b.points ? +1 : a.points > b.points ? -1 : 0;
  });

  return result;
}
