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
    _ = require('underscore');

// ****************************

var games = ["multi-fantastic-bits", "fantastic-bits", "multi-hypersonic", "multi-codebusters", "multi-smash-the-code", "multi-coders-strike-back", "multi-back-to-the-code", "multi-great-escape", "multi-platinum-rift2", "multi-platinum-rift", "multi-poker-chip-race", "multi-game-of-drone", "multi-tron-battle", "hypersonic", "codebusters", "smash-the-code", "coders-strike-back", "sf2442", "back-to-the-code", "the-great-escape", "platinum-rift-2", "platinum-rift", "winamax", "parrot", "20"];
var optimizations = ["thor-codesize", "paranoid-codesize", "temperatures-codesize"];

// *****************************

var app = express();

app.get('/search*', function(req, res) {

  var game = req.query.game,
      player = req.query.player;

  if (!game || !player || (games.indexOf(game) == -1 && optimizations.indexOf(game) == -1)) {
    res.status(400).end();
    return;
  }

  if (games.indexOf(game) != -1) {
    var api = game.substring(0, 6) == 'multi-' ? 'getPuzzleLeaderboard' : 'getChallengeLeaderboard';

    game = game.replace('multi-', '');

    // Get the game leaderboard
    request({
      url : 'https://www.codingame.com/services/LeaderboardsRemoteService/' + api,
      method : 'POST',
      json : true,
      body : [game + '', "", "global"]
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
        url : 'https://www.codingame.com/services/gamesPlayersRankingRemoteService/findLastBattlesAndProgressByTestSessionHandle',
        method : 'POST',
        json : true,
        body : [user.testSessionHandle, null]
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

          res.type('json').set({
            'Access-Control-Allow-Origin' : 'http://cgstats.magusgeek.com'
          }).send(JSON.stringify({
            player : user,
            stats : compileStats(body.success, user.codingamer.userId, users),
            mode : 'multi'
          })).end();
      });
    });
  } else if (optimizations.indexOf(game) != -1) {
    request({
      url : 'https://www.codingame.com/services/LeaderboardsRemoteService/getPuzzleLeaderboard',
      method : 'POST',
      json : true,
      body : [game, "1724dffd64c8c26c9fa9a189691387b5760508", "global"]
    }, function(error, response, body) {
      if (error) {
        console.error(error);
        res.status(500).end();
        return;
      }

      if (!body || !body.success) {
        console.error('No success in body', body);
        res.status(500).end();
      }

      res.type('json').set({
          'Access-Control-Allow-Origin' : 'http://cgstats.magusgeek.com'
      }).send(JSON.stringify({
        player : player,
        stats : compileOptimizationStats(body.success.users, player),
        mode : 'optim'
      })).end();
    });
  }
});

app.listen(9888);

// *****************************

function getKey(players) {
  return _.pluck(players, 'userId').sort((a, b) => a > b).join(' ');
}

function compileStats(data, userId, users) {
  var stats = [[], [], []];
  for (var uId in users) {
    users[uId].draw = 0;
    users[uId].lose = 0;
    users[uId].beaten = 0;
    users[uId].total = 0;
    users[uId].winrate = 0;
    users[uId].winrateError = 0;
  }

  // Global winrate stats
  data.lastBattles.forEach(function(result) {
    if (result.done && result.players.length >= 2) {
      if (result.players.length === 2 && result.players[0].position === result.players[1].position) {
        // It's a draw in a 1v1 game
        var hisId = result.players[0].userId === userId ? result.players[1].userId : result.players[0].userId;

        if (users[hisId]) {
          users[hisId].total++;
          users[hisId].draw++;
        }
      } else {
        var position;
        var found = false;

        for (var i = 0; i < result.players.length; ++i) {
          if (result.players[i].userId == userId) {
            position = result.players[i].position;
          }

          if (result.players[i].userId == userId) {
            found = true;
          } else if (users.hasOwnProperty(result.players[i].userId)) {
            users[result.players[i].userId].total++;

            if (found) {
              users[result.players[i].userId].beaten++;
            } else {
              users[result.players[i].userId].lose++;
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

  for (var uId in users) {
    if (users[uId].total > 0 && uId != userId) {
      var numberOfGames = users[uId].beaten + users[uId].lose;
      users[uId].winrate = Math.round(users[uId].beaten * 100 / (numberOfGames));
      
      var winRateFraction = users[uId].winrate/100;
          
      users[uId].winrateError = 100 * 1.96 * Math.sqrt(winRateFraction * (1 - winRateFraction) / numberOfGames);
      users[uId].winrateError = Number(users[uId].winrateError.toFixed(1));
    }
  }

  users[userId].highlight = true;

  var result = {
    stats: stats,
    users: _.values(users)
  };

  return result;
}

function compileOptimizationStats(data, player) {
  var stats = {};

  data.forEach(function(rank) {
    if (!stats[rank.programmingLanguage]) {
      stats[rank.programmingLanguage] = {
        rank : 0,
        total : 0,
        found : false
      };
    }

    var stat = stats[rank.programmingLanguage];

    if (!stat.found) {
      stat.rank += 1;
    }

    if ((rank.pseudo || '').toLowerCase() == player.toLowerCase()) {
      stat.found = true;
    }

    stat.total += 1;
  });

  var result = [];

  for (var language in stats) {
    var stat = stats[language];
    if (stat.found) {
      result.push({
        language : language,
        rank : stat.rank,
        total : stat.total,
        points : Math.round(Math.pow(200, (stat.total - stat.rank + 1)/stat.total))
      });
    }
  }

  result.sort(function(a, b) {
    return a.points < b.points ? +1 : a.points > b.points ? -1 : 0;
  });

  return result;
}
