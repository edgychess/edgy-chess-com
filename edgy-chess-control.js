/*
 * Chess variant: Edgy Chess
 *
 * Version: 1.0
 * Author: Marc Bernard, 2017-08-01
 *
 * Copyright(c) 2017-2020. All rights reserved.
 *
 * http://www.edgychess.com/
 *
 * Edgy Chess uses the same geometry, same type of pieces, same number of pieces, castling, an
 * in general the same rules as classic chess. It does use different initial positions (King in opposing
 * corners with other pieces surrounding kind like in classic chess). It also enhances the movement graph
 * for Pawns (move forward diagonally; capture orthogonally).
 *
 * This all makes a lot of sense when you see the board with the corner pointing towards you. The beauty
 * of this variant is that it can be played with any classic chess board and pieces available in the world
 * and is super easy to learn for anyone who knows how to play chess. It looks like chess but it's a new
 * game. Same, same, but different. Enjoy! :-)
 *
 *
 * Copyright(c) 2013-2017 - jocly.com
 *
 * You are allowed to use and modify this source code as long as it is exclusively for use in the Jocly API.
 *
 * Original authors: Jocly team
 *
 */

var EdgyChessHost = "edgychess.com";
var classicChessName = "classic-chess";
var defaultGameName = "edgy-chess";
var defaultGameTitle = "Edgy Chess<br/><div id=\"game-subtitle\">by Edge and Marc Bernard</div>";

/*
 * Run the game
 */
var movePending = null;

function ShowProgress(progressBar, progress) {
	if (progressBar)
		if (progress == 0) {
			progressBar.style.display = "block";
			progressBar.style.width = 0;
		} else if (progress > 0) {
			progressBar.style.width = progress + "%";
		} else {
			progressBar.style.display = "none";
		}
}

function ShowEnd(match, progressBar) {
	ShowProgress(progressBar, -1);

	match.getFinished()
		.then( (result) => {
			if (result.finished) {
				match.showEnd(true);

				var text = "Draw";
				if (result.winner==Jocly.PLAYER_A)
					text = "Checkmate: Player A wins!";
				else if (result.winner==Jocly.PLAYER_B)
					text = "Checkmate: Player B wins!";
				$("#game-status").text(text);
			}
			else {
				// Cuurently only Edgy Chess has option to turn off 3d messages
				if (match.gameName == defaultGameName) match.showEnd(false);
			}
		});
}

function RunMatch(match, progressBar) {
	var movePendingResolver;

	// first make sure there is no user input or machine search in progress
	var promise = match.abortUserTurn() // just in case one is running
		.then( () => {
			return match.abortMachineSearch(); // just in case one is running
		});

	ShowEnd(match, progressBar);

	function NextMove() {
		if (movePending)
			return;
		movePending = new Promise( (resolve,reject) => {
			movePendingResolver = resolve;
		});

		// whose turn is it ?
		match.getTurn()
			.then( (player) => {
				// display whose turn
				$("#game-status").text(player == Jocly.PLAYER_A ? "Player A's turn" : "Player B's turn");

				var mode = $("#mode").val();
				var promise = Promise.resolve();

				if ((player==Jocly.PLAYER_A && (mode=="self-self" || mode=="self-comp")) ||
					(player==Jocly.PLAYER_B && (mode=="self-self" || mode=="comp-self")))
						// user to play
						promise = promise.then( () => {
							// request user input
							return match.userTurn()
						})
					else {
						// machine to play
						ShowProgress(progressBar,0);

						promise = promise.then( () => {
								return match.getConfig();
							})
							.then( (config) => {
								// get machine level
								var which = player==Jocly.PLAYER_A ? "a" : "b";
								var levelIndex = $("#select-level-"+which).val();
								var level = {
									maxDepth: -1, // kind of random
								}
								if (levelIndex>=0)
									level = config.model.levels[levelIndex];
								// start machine search
								return match.machineSearch({
									level: level,
									progress: (progress) => {
										ShowProgress(progressBar,progress);
									}
								})
							})
							.then( (result) => {
								return match.getMoveString(result.move)
									.then((str)=>{
										console.info("Played move:",str);
										return result;
									})
							})
							.then( (result) => {
								// at this point we know the machine move but it has not been played yet
								// let's play that move
								return match.playMove(result.move);
							});
					}

				promise.then( () => {
						// is game over ?
						return match.getFinished()
					})
					.then( (result) => {
						movePending = null;
						movePendingResolver();
						if (result.finished) {
							ShowEnd(match, progressBar);
						} else {
							NextMove();
						}
					})
					.catch( (e) => {
						movePending = null;
						movePendingResolver();
						// console.warn("Turn aborted:",e);
					})
					.then( () => {
						ShowProgress(progressBar,-1);
					});
			})
	} // NextMove

	match.getFinished()
		.then( (result) => {
			// make sure the game is not finished to request next move
			if (!result.finished) {
				if (movePending) {
					movePending.then( () => {
						NextMove();
					})
				} else
					NextMove();
			}
		});

} // RunMatch

$(document).ready( function () {
	// get game name from url parameter (default "edgy-chess")
	var m = /\?game=([^&]+)/.exec(window.location.href);
	var gameName = m && m[1] || defaultGameName;

	var progressBar = document.getElementById("progress-bar");
	var area = document.getElementById("jocly-applet");

	var host = window.location.host;
	if ( host.indexOf( EdgyChessHost ) < 0 ) {
		$("#links-edgy-chess").hide();
		$("#links-other").show();
	} else {
		$("#links-edgy-chess").show();
		$("#links-other").hide();
	}

	function GetItem(item) {
		return window.localStorage && window.localStorage["JOCLY-"+gameName+"."+item] && JSON.parse(window.localStorage["JOCLY-"+gameName+"."+item]) || undefined;
	}

	function SetItem(item,value) {
		if (window.localStorage) window.localStorage.setItem("JOCLY-"+gameName+"."+item, JSON.stringify(value));
	}

	Jocly.createMatch(gameName).then( (match) => {
		ShowEnd(match, progressBar);

		// get game configuration to setup control UI
		match.getConfig().then( (config) => {
			// get and set game title (default "Edgy Chess")
			var gameTitle = config.model["title-en"];
			if (gameName == defaultGameName) gameTitle = defaultGameTitle;
			$("#game-title").html(gameTitle);

			// fills skins dropdown with available skins
			config.view.skins.forEach(function(skin) {
				$("<option/>").attr("value",skin.name).text(skin.title).appendTo($("#options-skin"));
			});

			// configure computer level dropdonws
			["a","b"].forEach( (which) => {
				$("<option/>").attr("value","-1").text("Random").appendTo($("#select-level-"+which));

				config.model.levels.forEach( (level, index) => {
					$("<option/>").attr("value",index).text(level.label).appendTo($("#select-level-"+which));
				});
			});

			// get saved view options and game config if any
			var viewOptions = GetItem("options");
			var gameConfig  = GetItem("config") || { mode:"self-comp", levelA:0, levelB:0 };

			// the match need to be attached to a DOM element for displaying the board
			match.attachElement(area, { viewOptions: viewOptions })
				.then( () => {
					return match.getViewOptions();
				})
				// get options for the game view
				.then( (options) => {
					$("#options-skin").val(options.skin);

					$("#options-sounds").hide();
					if (options.sounds!==undefined)
						$("#options-sounds").show().children("input").prop("checked",options.sounds);

					$("#options-notation").hide();
					if (options.notation!==undefined)
						$("#options-notation").show().children("input").prop("checked",options.notation);

					$("#options-moves").hide();
					if (options.showMoves!==undefined)
						$("#options-moves").show().children("input").prop("checked",options.showMoves);

					$("#options-autocomplete").hide();
					if (options.autoComplete!==undefined)
						$("#options-autocomplete").show().children("input").prop("checked",options.autoComplete);

					$("#options-anaglyph").hide();
					if (options.anaglyph!==undefined)
						$("#options-anaglyph").show().children("input").prop("checked",options.anaglyph);

					$("#options-view-as").hide();
					if (config.view.switchable && options.viewAs!==undefined) {
						switch(options.viewAs) {
							case Jocly.PLAYER_A: options.viewAs = "player-a"; break;
							case Jocly.PLAYER_B: options.viewAs = "player-b"; break;
						}
						$("#options-view-as").show().val(options.viewAs);
					}

					// checkboxes for options
					$("#view-options").on("change", function() {
						var opts={};

						if ($("#options-skin").is(":visible"))
							opts.skin=$("#options-skin").val();
						if ($("#options-notation").is(":visible"))
							opts.notation=$("#options-notation-input").prop("checked");
						if ($("#options-moves").is(":visible"))
							opts.showMoves=$("#options-moves-input").prop("checked");
						if ($("#options-autocomplete").is(":visible"))
							opts.autoComplete=$("#options-autocomplete-input").prop("checked");
						if ($("#options-sounds").is(":visible"))
							opts.sounds=$("#options-sounds-input").prop("checked");
						if ($("#options-anaglyph").is(":visible"))
							opts.anaglyph=$("#options-anaglyph-input").prop("checked");
						if ($("#options-view-as").is(":visible")) {
							opts.viewAs=$("#options-view-as").val();
							switch(opts.viewAs) {
								case "player-a": opts.viewAs = Jocly.PLAYER_A; break;
								case "player-b": opts.viewAs = Jocly.PLAYER_B; break;
							}
						}

						SetItem("options",opts);

						if (opts.skin == "skin3d" || opts.skin == "skin3dflat") {
							$("#options-anaglyph").show();
							$("#options-panorama").show();
							$("#camera-panel").show();
						} else {
							$("#options-anaglyph").hide();
							$("#options-panorama").hide();
							$("#camera-panel").hide();
						}

						if (opts.anaglyph == true)
							match.viewControl("enterAnaglyph");
						else
							match.viewControl("exitAnaglyph");

						match.setViewOptions(opts)
							.then( () => {
								RunMatch(match,progressBar);
							});
					});

					// dropdown to change the players (user/machine)
					$("#mode").val(gameConfig.mode);

					$("#level-a").hide();
					if (gameConfig.mode == "comp-comp" || gameConfig.mode == "comp-self") {
						$("#level-a").show();
						$("#select-level-a").val(gameConfig.levelA);
					}

					$("#level-b").hide();
					if (gameConfig.mode == "comp-comp" || gameConfig.mode == "self-comp") {
						$("#level-b").show();
						$("#select-level-b").val(gameConfig.levelB);
					}

					$("#game-config").on("change", function() {
						var cfg = {};

						cfg.mode = $("#mode").val();
						cfg.levelA = $("#select-level-a").val();
						cfg.levelB = $("#select-level-b").val();

						SetItem("config",cfg);

						switch(cfg.mode) {
							case "self-self": $("#level-a,#level-b").hide(); break;
							case "comp-comp": $("#level-a,#level-b").show(); break;
							case "self-comp": $("#level-a").hide(); $("#level-b").show(); break;
							case "comp-self": $("#level-a").show(); $("#level-b").hide(); break;
						}

						RunMatch(match,progressBar);
					});

				})
				.then( () => {
					RunMatch(match,progressBar);
				}); // match.attachElement


			// restart match from the beginning
			$("#restart").on("click", function() {
				match.rollback(0)
					.then( () => {
						RunMatch(match,progressBar);
					});
			});

			// save match to the file system
			$("#save").on("click", function() {
				match.save()
					.then( (data) => {
						var json = JSON.stringify(data,null,2);
						var a = document.createElement("a");
						var uriContent = "data:application/octet-stream," + encodeURIComponent(json);
						a.setAttribute("href",uriContent);
						a.setAttribute("download",gameName+".json");
						a.click();
					})
					.catch((error)=>{
						console.warn("Failed:",error);
					});
			});

			// take JPEG snapshot of game
			$("#snapshot").on("click", function() {
				match.viewControl("takeSnapshot",{ format: "jpeg" })
					.then((snapshot) => {
						var a = document.createElement("a");
						a.href = snapshot;
						a.setAttribute("download",gameName+".jpg");
						a.click();
					})
					.catch((error)=>{
						console.warn("Failed:",error);
					});
			});

			// reading game file locally
			var fileElem = $("#fileElem").on("change", function() {
				var fileReader = new FileReader();
				fileReader.readAsText(fileElem[0].files[0]);
				fileReader.onload = function(event) {
					var json = event.target.result;
					var data = JSON.parse(json);

					// load match
					match.load(data)
						.then( () => {
							RunMatch(match,progressBar);
						})
						.catch((error)=>{
							console.info("Failed to load game file",error);
							alert("Failed to load game file");
						});
				}
			})
			$("#load").on("click", () => {
				fileElem[0].click();
			});

			// reading 360 panorama locally
			var file360Elem = $("#file360Elem").on("change", function() {
				var fileReader = new FileReader();
				fileReader.readAsDataURL(file360Elem[0].files[0]);
				fileReader.onload = function(event) {
					match.viewControl("setPanorama",{ pictureData: fileReader.result });
				}
			})
			$("#panorama-button").on("click", function() {
				file360Elem[0].click();
			});

			$("#panorama-select").on("change", function() {
				var options = {};
				var which = $(this).val();
				if (which)
					options.pictureUrl = "../../panorama/"+which+".jpg";
				match.viewControl("setPanorama",options);
			});

			$("#takeback").on("click", function() {
				match.getPlayedMoves()
					.then( (playedMoves) => {
						// we want to go back to the last user move
						var mode = $("#mode").val();
						var lastUserMove = -1;
						if (
							((playedMoves.length % 2 == 1) && (mode=="self-self" || mode=="self-comp")) ||
							((playedMoves.length % 2 == 0) && (mode=="self-self" || mode=="comp-self"))
							)
								lastUserMove = playedMoves.length - 1;
						else if (
							((playedMoves.length % 2 == 1) && (mode=="self-self" || mode=="comp-self")) ||
							((playedMoves.length % 2 == 0) && (mode=="self-self" || mode=="self-comp"))
							)
								lastUserMove = playedMoves.length - 2;
						if (lastUserMove>=0)
							match.rollback(lastUserMove)
								.then( () => {
									RunMatch(match,progressBar);
								});
					});
			});

			// yeah, using the fullscreen API is not as easy as it should be
			var requestFullscreen = area.requestFullscreen || area.webkitRequestFullscreen ||
				area.webkitRequestFullScreen || area.mozRequestFullScreen;
			if (requestFullscreen) {
				$(document).on("webkitfullscreenchange mozfullscreenchange fullscreenchange", function() {
					var isFullscreen = document.webkitFullscreenElement || document.webkitFullScreenElement ||
						document.mozFullScreenElement || document.fullscreenElement;

					if (isFullscreen)
						area.style.display = "block";
					else
						area.style.display = "table-cell";

					RunMatch(match,progressBar);
				});
				$("#fullscreen").show().on("click", function() {
					requestFullscreen.call(area);
				});
			}

			// camera controls
			$("#view0, #view1, #view2, #view3, #animate0, #animate1, #animate2, #animate3").on("click", function() {
				var skin = $("#options-skin").val();

				if (skin == "skin3d" || skin == "skin3dflat") {
					var camera = {};
					switch(this.id) {
						// corner
						case "view0":    camera = { type: "move", camera: { x: -8500, y: 9000, z: 9000, targetX: 0, targetY: 800, targetZ: 0, }, speed: 0, }; break;
						case "animate0": camera = { type: "move", camera: { x: -8500, y: 9000, z: 9000, targetX: 0, targetY: 800, targetZ: 0, }, speed: 4, }; break;
						// top
						case "view1":    camera = { type: "move", camera: { x: 0, y: 300, z: 16000, targetX: 0, targetY: 0, targetZ: 0, }, speed: 0, }; break;
						case "animate1": camera = { type: "move", camera: { x: 0, y: 300, z: 16000, targetX: 0, targetY: 0, targetZ: 0, }, speed: 4, }; break;
						// front
						case "view2":    camera = { type: "move", camera: { x: 0, y: 10500, z: 6300, targetX: 0, targetY: 0, targetZ: 0, }, speed: 0, }; break;
						case "animate2": camera = { type: "move", camera: { x: 0, y: 10500, z: 6300, targetX: 0, targetY: 0, targetZ: 0, }, speed: 4, }; break;
						// close-up
						case "view3":    camera = { type: "move", camera: { x: -8000, y: -3000, z: 3000, targetX: -4000, targetY: 0, targetZ: 0, }, speed: 0, }; break;
						case "animate3": camera = { type: "move", camera: { x: -8000, y: -3000, z: 3000, targetX: -4000, targetY: 0, targetZ: 0, }, speed: 4, }; break;
					}
					match.viewControl("setCamera",camera);
				}
			});

			$("#get-camera").on("click", function() {
				var skin = $("#options-skin").val();

				if (skin == "skin3d" || skin == "skin3dflat")
					match.viewControl("getCamera")
						.then( (camera) => {
							console.info("Camera:",camera);
							var html = "";
							for(var prop in camera)
								html += prop + ": " + Math.round(camera[prop]) + "<br/>";
							$("#camera-position").html(html);
						});
			});

			// show rules or credits
			$("#game-rules, #game-credits").on("click", function() {
				$("#controls").hide();
				var htmlBegin = "<!--BEGIN-->";
				var htmlEnd   = "<!--END-->";
				var rulePath = "dist/browser/games/" + config.model.module;
				var ruleFile = rulePath + "/";
				var ruleTitle = gameTitle;
				switch(this.id) {
					case "game-rules":
						ruleTitle = "Rules for " + ruleTitle;
						ruleFile += config.model.rules["en"];
						break;
					case "game-credits":
						ruleTitle = "Credits for " + ruleTitle;
						ruleFile += config.model.credits["en"];
						break;
				}
				$("#rule-header").html(ruleTitle);
				var ruleHtml = $.ajax({ url: ruleFile, async: false, type: "GET" }).responseText;
				ruleHtml = ruleHtml.replace(/\{GAME\}/gi, rulePath);

				if (ruleHtml.search(htmlBegin) > 0)
					ruleHtml = ruleHtml.split(htmlBegin)[1];
				if (ruleHtml.search(htmlEnd) > 0)
					ruleHtml = ruleHtml.split(htmlEnd)[0];

				$("#rule-text").html(ruleHtml);
				$("#rules").show();
			});

			// list all available games
			Jocly.listGames()
				.then( (_games) => {
					// _games is an object, make an array from it
					var games = Object.keys(_games).map((gameName)=>{
						return Object.assign(_games[gameName],{
							gameName: gameName
						});
					});
					// sorting by title
					games.sort( (a,b) => {
						if (b.title<a.title)
							return 1;
						else if (b.title>a.title)
							return -1;
						else
							return 0;
					});
					// build the list of games
					var gameClass = "";
					games.forEach( (game) => {
						if (game.gameName == defaultGameName)
							gameClass = "game-descr-" + defaultGameName;
						else if (game.gameName == classicChessName)
							gameClass = "game-descr-" + classicChessName;
						else
							gameClass = "";

						$("<div>")
							.addClass("game-descr")
							.addClass(gameClass)
							.css({
								backgroundImage: "url('"+game.thumbnail+"')"
							})
							.append($("<div>").addClass("game-descr-name").text(game.title))
							.append($("<div>").addClass("game-descr-summary").text(game.summary))
							.bind("click",()=>{
								var url0 = window.location;
								var url = url0.origin + url0.pathname + "?game=" + game.gameName;
								window.location = url;
							}).appendTo($("#game-list"));

					})
				});

			}); // match.getConfig

	}); // Jocly.createMatch

	// switch side panels
	$("#other-games").on("click", function() {
		$("#controls").hide();
		$("#games").show();
	});

	$("#close-games, #close-rules").on("click", function() {
		$("#controls").show();
		$("#games").hide();
		$("#rules").hide();
	});

	// box toggles
	$("#box-toggle-controls, #box-toggle-options, #box-toggle-camera").on("click", function() {
		var toggleID = '#' + this.id;
		var insideID = toggleID.replace("toggle","inside");
		if ( $(toggleID).hasClass("box-toggle-open") ) {
			$(toggleID).removeClass("box-toggle-open").addClass("box-toggle-close");
			$(insideID).removeClass("box-inside-open").addClass("box-inside-close");
		} else {
			$(toggleID).removeClass("box-toggle-close").addClass("box-toggle-open");
			$(insideID).removeClass("box-inside-close").addClass("box-inside-open");
		}
	});

}); // document

