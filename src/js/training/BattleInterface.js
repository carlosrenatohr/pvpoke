/*
* Interface functionality for move list and explorer
*/

var BattlerMaster = (function () {
    var instance;

    function createInstance(matchHandler) {


        var object = new interfaceObject(matchHandler);

		function interfaceObject(matchHandler){
			var handler = matchHandler;

			var self = this;
			var gm = GameMaster.getInstance();
			var battle;
			var players;
			var phase;
			var activePokemon = []; // The currently active Pokemon

			var multiSelectors = [];

			// Variables for handling charge up
			var charge = 0;
			var maxCharge = 100;
			var chargeRate = 20;
			var chargeDecayRate = 0.5;
			var phaseInterval;
			var chargeTime = 4000;
			var switchTime = 13000;
			var phaseTimer = 4000;
			var countdown = 0;

			var interfaceLockout = 0; // Prevent clicking the shield or switch options too early

			// Kick off the setup and the battle

			this.init = function(props, b, p){
				battle = b;
				players = p;
				phase = "countdown";

				// Event listeners

				$(".battle-window").on("click", battleWindowClick);
				$("body").on("click", ".charge-window .move-bar", chargeUpClick);
				$(".shield-window .close").on("click", closeShieldClick);
				$(".shield-window .shield").on("click", useShieldClick);

				// Set lead pokemon
				battle.setBattleMode("emulate");
				battle.setPlayers(players);
				battle.setNewPokemon(players[0].getTeam()[0], 0, false);
				battle.setNewPokemon(players[1].getTeam()[0], 1, false);
				battle.emulate(self.update);

				$("body").addClass("battle-active");
			};

			// Given an update object, update the battle interface

			this.update = function(response){

				// Interpret phase for player

				if(response.phase == "suspend_charged"){
					if(response.actor == 0){
						response.phase = "suspend_charged_attack";
					} else{
						response.phase = "suspend_charged_shield";
					}
				}

				if(response.phase == "suspend_switch"){
					if(response.actors.indexOf(0) > -1){
						response.phase = "suspend_switch_self";
					}
				}

				// Handle phase change

				if(phase != response.phase){
					switch(response.phase){
						case "suspend_charged_attack":
							$(".charge-window .move-bars").html('');
							$(".charge-window .move-bars").append($(".controls .move-bar").eq(response.move).clone());
							$(".switch-window").removeClass("active");

							charge = 0;
							phaseTimer = chargeTime;
							phaseInterval = setInterval(chargeUpStep, 1000 / 60);
							break;

							case "suspend_charged_shield":
								$(".shield-window").removeClass("closed");
								phaseTimer = chargeTime;
								phaseInterval = setInterval(phaseStep, 1000 / 60);
								interfaceLockout = 500;
								break;

						case "animating":
							$(".animate-message .text").html(activePokemon[response.actor].speciesName + " used " + response.moveName);
							break;

						case "suspend_switch_self":
							phaseTimer = switchTime;
							phaseInterval = setInterval(phaseStep, 1000 / 60);
							self.openSwitchWindow();
							interfaceLockout = 500;
							break;

						case "game_over":
							$("body").removeClass("battle-active");

							self.displayEndGameStats();
							break;
					}
				}

				// Update Pokemon displays

				for(var i = 0; i < response.pokemon.length; i++){
					var pokemon = response.pokemon[i];

					var $poke = $(".pokemon-container").eq(i);

					$poke.find(".hp .bar").css("width", ((pokemon.hp / pokemon.stats.hp) * 100)+"%" );

					// If a switch has occured, update the Pokemon display and Charged Move buttons
					if((activePokemon.length < i)||(activePokemon[i] != pokemon)){
						$poke.find(".name").html(pokemon.speciesName);
						$poke.attr("cooldown", pokemon.fastMove.cooldown);

						// Show both Pokemon at the start
						if(response.turn == 1){
							$poke.find(".pokemon").attr("class", "pokemon " + pokemon.types[0]);
						}

						if(i == 0){
							$(".move-bar").hide();

							for(var n = 0; n < pokemon.chargedMoves.length; n++){
								var chargedMove = pokemon.chargedMoves[n];
								var $bar = $(".battle-window .move-bar").eq(n);

								$bar.show();
								$bar.find(".label").html(chargedMove.abbreviation);
								$bar.find(".bar").attr("class","bar " + chargedMove.type);
								$bar.find(".bar-back").attr("class","bar-back " + chargedMove.type);
							}
						}
					}

					// Update move buttons

					if(i == 0){
						for(var n = 0; n < pokemon.chargedMoves.length; n++){
							var chargedMove = pokemon.chargedMoves[n];
							var $bar = $(".battle-window .move-bar").eq(n);
							var chargePercent = (pokemon.energy / chargedMove.energy) * 100;

							$bar.find(".bar").first().css("height", chargePercent+"%");

							if(chargePercent >= 100){
								$bar.addClass("active");
							} else{
								$bar.removeClass("active");
							}
						}
					}
				}

				// Update player displays

				for(var i = 0; i < response.players.length; i++){
					var player = response.players[i];

					$(".battle-window .shields").eq(i).html(player.getShields());

					// Display Pokeballs for remaining Pokemon
					var activePokemonCount = 0;
					var team = player.getTeam();
					for(var n = 0; n < team.length; n++){
						if(team[n].hp > 0){
							activePokemonCount++;
						}
					}


					$(".team-indicator").eq(i).find(".ball").addClass("fainted");

					for(var j = 0; j < activePokemonCount; j++){
						if(i == 0){
							$(".team-indicator.left .ball").eq(j).removeClass("fainted");
						} else{
							$(".team-indicator.right .ball").eq(2-j).removeClass("fainted");
						}
					}

					// Update switch timer

					if(i == 0){
						if(player.getSwitchTimer() == 0){
							$(".battle-window .switch-btn").addClass("active");
							$(".battle-window .switch-btn").html("&#8645;");
						} else{
							$(".battle-window .switch-btn").removeClass("active");
							$(".battle-window .switch-btn").html(Math.floor(player.getSwitchTimer() / 1000));
						}
					}
				}

				activePokemon = [];
				for(var i = 0; i < response.pokemon.length;i++){
					activePokemon.push(response.pokemon[i]);
				}
				phase = response.phase;

				$(".battle-window").attr("phase", phase);

				switch(phase){
					case "countdown":

						if((response.countdown !== undefined)&&(countdown+1 != response.countdown)){
							countdown = response.countdown-1;
							if(countdown == 0){
								countdown = "Go";
							}

							$(".battle-window .countdown").removeClass("animate");
							$(".battle-window .countdown .text").html(countdown);

							setTimeout(function(){
								$(".battle-window .countdown").addClass("animate");
							}, 50);
						}

						break;
				}

				// Display messages for this turn

				for(var i = 0; i < response.messages.length; i++){
					var message = response.messages[i];
					var $messageItem = $("<div turn=\""+response.turn+"\">"+message.str+"</div>");
					$(".battle-window .pokemon-container").eq(message.index).find(".messages").append($messageItem);
				}

				// Clear any messages past the expiry time

				$(".battle-window .messages div").each(function(index, value){
					var messageTurn = parseInt($(this).attr("turn"));
					if(response.turn - messageTurn >= 4){
						$(this).remove();
					}
				});

				// Display any new animations

				for(var i = 0; i < response.animations.length; i++){
					var animation = response.animations[i];
					var fastAnimationOccurred = false;

					switch(animation.type){
						case "fast":
							fastAnimationOccurred = true;
							$(".battle-window .pokemon-container").eq(animation.actor).addClass("animate-fast");
							break;

						case "switch":
							var actor = animation.actor;
							$(".battle-window .pokemon-container").eq(animation.actor).addClass("animate-switch");

							setTimeout(function(){
								$(".battle-window .pokemon-container").eq(actor).removeClass("animate-switch");
								self.completeSwitchAnimation(actor);
							}, 1000);
							break;
					}

					if(fastAnimationOccurred){
						setTimeout(function(){
							$(".battle-window .pokemon-container").removeClass("animate-fast");
						}, 250);
					}
				}
			}


			// Decrement the timer and update UI
			self.updatePhaseTimer = function(){
				// Update timer
				phaseTimer = Math.max(phaseTimer - 1000 / 60, 0);
				interfaceLockout = Math.max(interfaceLockout - 1000 / 60, 0);
				$(".battle-window .timer .text").html(Math.floor(phaseTimer / 1000));

				if(phaseTimer <= 0){
					clearInterval(phaseInterval);
				}
			}

			self.openSwitchWindow = function(){
				// Update the switch window Pokemon
				var team = players[0].getTeam();
				var index = 0;

				for(var i = 0; i < team.length; i++){
					if(team[i] != activePokemon[0]){
						$(".switch-window .pokemon").eq(index).find(".cp").html(team[i].cp);
						$(".switch-window .pokemon").eq(index).find(".name").html(team[i].speciesName);
						$(".switch-window .pokemon").eq(index).attr("index", i);
						$(".switch-window .pokemon").eq(index).find(".img-container").attr("class", "img-container " + team[i].types[0]);
						if(team[i].hp > 0){
							$(".switch-window .pokemon").eq(index).addClass("active");
						} else{
							$(".switch-window .pokemon").eq(index).removeClass("active");
						}
						index++;
					}
				}
			}

			// When a switch animation has completed, fill in the updated sprite

			self.completeSwitchAnimation = function(index){
				$(".battle-window .pokemon-container").eq(index).find(".pokemon").attr("class", "pokemon " + activePokemon[index].types[0]);
			}

			// At the end of the game, show relevant battle stats

			self.displayEndGameStats = function(){
				var team = players[0].getTeam();
				var maxScore = 300;

				console.log(team);

				for(var i = 0; i < team.length; i++){
					var pokemon = team[i];
					var width = (pokemon.battleStats.damage / maxScore) * 100;

					$(".battle-stats .damage .pokemon-entry .name").eq(i).html(pokemon.speciesId);
					$(".battle-stats .damage .pokemon-entry .damage-bar").eq(i).css("width", width+"%");
				}

			}

			// Handler for the charge up interval

			function chargeUpStep(){
				charge = Math.max(charge - chargeDecayRate, 0);

				// Update rings
				var percent = (charge / maxCharge) * 100;

				$(".battle-window .charge-window .ring").css("width", percent + "%");
				$(".battle-window .charge-window .ring").css("height", percent + "%");

				self.updatePhaseTimer();

				// Submit charge amount to Battle
				if(phaseTimer <= 0){
					var chargeMultiplier = Math.min(charge / maxCharge, 1);
					battle.setChargeAmount(chargeMultiplier);
				}
			}

			// Click handler for sending input to the Battle object

			function battleWindowClick(e){
				if(interfaceLockout > 0){
					return false;
				}

				// Open or close switch window
				if($(".battle-window .switch-btn.active:hover").length > 0){
					$(".switch-window").toggleClass("active");
					if($(".switch-window").hasClass("active")){
						self.openSwitchWindow();
					}
					return;
				}

				// Queue a switch
				if($(".switch-window .pokemon.active:hover").length > 0){
					var $target = $(e.target);

					if(! $target.hasClass("pokemon")){
						$target = $(e.target).closest(".pokemon");
					}

					var index = parseInt($target.attr("index"));
					battle.queueAction(0, "switch", index);

					$(".switch-window").removeClass("active");

					if(phase == "suspend_switch_self"){
						clearInterval(phaseInterval);
					}

					return;
				}


				if($(".battle-window .controls .move-bar.active:hover").length == 0){
					// Fast move
					battle.queueAction(0, "fast", 0);
				} else{
					// Charged move
					var $target = $(e.target);

					if(! $target.hasClass("move-bar")){
						$target = $(e.target).closest(".move-bar");
					}

					var index = $(".battle-window .controls .move-bar").index($target); // Getting the index of the move
					battle.queueAction(0, "charged", index);
				}
			}

			// Click handler for sending input to the Battle object

			function chargeUpClick(e){
				if(phase != "suspend_charged_attack"){
					return false;
				}

				// We have to let it overshoot a little because the decay happens after the charge
				charge = Math.min(charge + chargeRate, maxCharge + (chargeDecayRate * 10));
			}

			// Close the shield window

			function closeShieldClick(){
				if(interfaceLockout == 0){
					$(".battle-window .shield-window").addClass("closed");
				}
			}

			// Use a shield

			function useShieldClick(){
				if(interfaceLockout == 0){
					$(".battle-window .shield-window").addClass("closed");
					battle.setPlayerUseShield(true);
				}
			}

			// Handler for the the use shield timer

			function phaseStep(){
				self.updatePhaseTimer();
			}
		}

        return object;
    }

    return {
        getInstance: function (matchHandler) {
            if (!instance) {
                instance = createInstance(matchHandler);
            }
            return instance;
        }
    };
})();