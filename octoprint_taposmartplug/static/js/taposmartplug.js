/*
 * View model for OctoPrint-TapoSmartplug
 *
 * Author: jneilliii
 * License: AGPLv3
 */
$(function() {
	function taposmartplugViewModel(parameters) {
		var self = this;

		self.settings = parameters[0];
		self.loginState = parameters[1];
		self.filesViewModel = parameters[2];

		self.filesViewModel.getAdditionalData = function(data) {
			var output = "";
			if (data["gcodeAnalysis"]) {
				if (data["gcodeAnalysis"]["dimensions"]) {
					var dimensions = data["gcodeAnalysis"]["dimensions"];
					output += gettext("Model size") + ": " + _.sprintf("%(width).2fmm &times; %(depth).2fmm &times; %(height).2fmm", dimensions);
					output += "<br>";
				}
				if (data["gcodeAnalysis"]["filament"] && typeof(data["gcodeAnalysis"]["filament"]) === "object") {
					var filament = data["gcodeAnalysis"]["filament"];
					if (_.keys(filament).length === 1) {
						output += gettext("Filament") + ": " + formatFilament(data["gcodeAnalysis"]["filament"]["tool" + 0]) + "<br>";
					} else if (_.keys(filament).length > 1) {
						_.each(filament, function(f, k) {
							if (!_.startsWith(k, "tool") || !f || !f.hasOwnProperty("length") || f["length"] <= 0) return;
							output += gettext("Filament") + " (" + gettext("Tool") + " " + k.substr("tool".length)
								+ "): " + formatFilament(f) + "<br>";
						});
					}
				}
				output += gettext("Estimated print time") + ": " + (self.settings.appearance_fuzzyTimes() ? formatFuzzyPrintTime(data["gcodeAnalysis"]["estimatedPrintTime"]) : formatDuration(data["gcodeAnalysis"]["estimatedPrintTime"])) + "<br>";
			}
			if (data["prints"] && data["prints"]["last"]) {
				output += gettext("Last printed") + ": " + formatTimeAgo(data["prints"]["last"]["date"]) + "<br>";
				if (data["prints"]["last"]["printTime"]) {
					output += gettext("Last print time") + ": " + formatDuration(data["prints"]["last"]["printTime"]) + "<br>";
				}
			}
			if (data["statistics"] && data["statistics"]["lastPowerCost"]) {
				output += gettext("Last power cost") + ": " + data["statistics"]["lastPowerCost"]["_default"] + "<br>";
			}
			return output;
		};

		self.arrSmartplugs = ko.observableArray();
		self.isPrinting = ko.observable(false);
		self.selectedPlug = ko.observable();
		self.processing = ko.observableArray([]);
		self.plotted_graph_ip = ko.observable(false);
		self.plotted_graph_records = ko.observable(10);
		self.plotted_graph_records_offset = ko.observable(0);
		self.dictSmartplugs = ko.observableDictionary();
		self.refreshVisible = ko.observable(true);
		self.powerOffWhenIdle = ko.observable(false);
		self.filteredSmartplugs = ko.computed(function(){
			return ko.utils.arrayFilter(self.dictSmartplugs.items(), function(item) {
						return "err_code" in item.value().emeter.get_realtime;
					});
		});

		self.show_sidebar = ko.computed(function(){
			return self.filteredSmartplugs().length > 0;
		});

		self.allPlugsDisabled =  ko.computed(function() {
			var enablePlug = null;
			enablePlug = ko.utils.arrayFirst(self.arrSmartplugs(), function(item) {
				return item.currentState() == "on" && "err_code" in item.emeter.get_realtime;
			});
			if (enablePlug == null)
				return false;
			return true;
		})

		self.toggleShutdownTitle = ko.pureComputed(function() {
			return self.settings.settings.plugins.taposmartplug.powerOffWhenIdle() ? 'Disable Automatic Power Off' : 'Enable Automatic Power Off';
		})

		// Hack to remove automatically added Cancel button
		// See https://github.com/sciactive/pnotify/issues/141
		PNotify.prototype.options.confirm.buttons = [];
		self.timeoutPopupText = gettext('Powering off in ');
		self.timeoutPopupOptions = {
			title: gettext('Automatic Power Off'),
			type: 'notice',
			icon: true,
			hide: false,
			confirm: {
				confirm: true,
				buttons: [{
					text: gettext('Cancel Power Off'),
					addClass: 'btn-block btn-danger',
					promptTrigger: true,
					click: function(notice, value){
						notice.remove();
						notice.get().trigger("pnotify.cancel", [notice, value]);
					}
				}]
			},
			buttons: {
				closer: false,
				sticker: false,
			},
			history: {
				history: false
			}
		};

		self.onToggleAutomaticShutdown = function(data) {
			if (self.settings.settings.plugins.taposmartplug.powerOffWhenIdle()) {
				$.ajax({
					url: API_BASEURL + "plugin/taposmartplug",
					type: "POST",
					dataType: "json",
					data: JSON.stringify({
						command: "disableAutomaticShutdown"
					}),
					contentType: "application/json; charset=UTF-8"
				})
			} else {
				$.ajax({
					url: API_BASEURL + "plugin/taposmartplug",
					type: "POST",
					dataType: "json",
					data: JSON.stringify({
						command: "enableAutomaticShutdown"
					}),
					contentType: "application/json; charset=UTF-8"
				})
			}
		}

		self.abortShutdown = function(abortShutdownValue) {
			self.timeoutPopup.remove();
			self.timeoutPopup = undefined;
			$.ajax({
				url: API_BASEURL + "plugin/taposmartplug",
				type: "POST",
				dataType: "json",
				data: JSON.stringify({
					command: "abortAutomaticShutdown"
				}),
				contentType: "application/json; charset=UTF-8"
			})
		}

		self.get_power = function(data){ // make computedObservable()?
			if("power" in data.emeter.get_realtime && typeof data.emeter.get_realtime.power == "function"){
				return data.emeter.get_realtime.power().toFixed(2);
			} else if ("power_mw" in data.emeter.get_realtime && typeof data.emeter.get_realtime.power_mw == "function") {
				return (data.emeter.get_realtime.power_mw()/1000).toFixed(2);
			} else if("power" in data.emeter.get_realtime && typeof data.emeter.get_realtime.power !== "function"){
				return data.emeter.get_realtime.power.toFixed(2);
			} else if ("power_mw" in data.emeter.get_realtime && typeof data.emeter.get_realtime.power_mw !== "function") {
				return (data.emeter.get_realtime.power_mw/1000).toFixed(2);
			} else {
				return "-"
			}
		}
		self.get_kwh = function(data){ // make computedObservable()?
			if("total" in data.emeter.get_realtime && typeof data.emeter.get_realtime.total == "function"){
				return data.emeter.get_realtime.total().toFixed(2);
			} else if ("total_wh" in data.emeter.get_realtime && typeof data.emeter.get_realtime.total_wh == "function") {
				return (data.emeter.get_realtime.total_wh()/1000).toFixed(2);
			} else if("total" in data.emeter.get_realtime && typeof data.emeter.get_realtime.total !== "function"){
				return data.emeter.get_realtime.total.toFixed(2);
			} else if ("total_wh" in data.emeter.get_realtime && typeof data.emeter.get_realtime.total_wh !== "function") {
				return (data.emeter.get_realtime.total_wh/1000).toFixed(2);
			} else {
				return "-"
			}
		}

		self.get_cost = function(data){ // make computedObservable()?
			if("total" in data.emeter.get_realtime && typeof data.emeter.get_realtime.total == "function"){
				return (data.emeter.get_realtime.total() * self.settings.settings.plugins.taposmartplug.cost_rate()).toFixed(2);
			} else if ("total_wh" in data.emeter.get_realtime && typeof data.emeter.get_realtime.total_wh == "function") {
				return ((data.emeter.get_realtime.total_wh()/1000) * self.settings.settings.plugins.taposmartplug.cost_rate()).toFixed(2);
			} else if("total" in data.emeter.get_realtime && typeof data.emeter.get_realtime.total !== "function"){
				return (data.emeter.get_realtime.total * self.settings.settings.plugins.taposmartplug.cost_rate()).toFixed(2);
			} else if ("total_wh" in data.emeter.get_realtime && typeof data.emeter.get_realtime.total_wh !== "function") {
				return ((data.emeter.get_realtime.total_wh/1000) * self.settings.settings.plugins.taposmartplug.cost_rate()).toFixed(2);
			} else {
				return "-"
			}
		}

		self.onStartup = function() {
			var sidebar_tab = $('#sidebar_plugin_taposmartplug');

			sidebar_tab.on('show', function() {
				self.refreshVisible(true);
			});

			sidebar_tab.on('hide', function() {
				self.refreshVisible(false);
			});
			sidebar_tab.removeClass('overflow_visible in').addClass('collapse').siblings('div.accordion-heading').children('a.accordion-toggle').addClass('collapsed');
		}

		self.onBeforeBinding = function() {
			self.arrSmartplugs(self.settings.settings.plugins.taposmartplug.arrSmartplugs());
		}

		self.onAfterBinding = function() {
			self.plotted_graph_ip.subscribe(self.plotEnergyData, self);
			self.plotted_graph_records.subscribe(self.plotEnergyData, self);
			self.plotted_graph_records_offset.subscribe(self.plotEnergyData, self);
			self.checkStatuses();
		}

		self.onSettingsBeforeSave = function(payload) {
			var plugs_updated = (ko.toJSON(self.arrSmartplugs()) !== ko.toJSON(self.settings.settings.plugins.taposmartplug.arrSmartplugs()));
			self.arrSmartplugs(self.settings.settings.plugins.taposmartplug.arrSmartplugs());
			if(plugs_updated){
				self.checkStatuses();
			}
		}

		self.onEventPrinterStateChanged = function(payload) {
			if (payload.state_id == "PRINTING" || payload.state_id == "PAUSED"){
				self.isPrinting(true);
			} else {
				self.isPrinting(false);
			}
		}

		self.onTabChange = function(current, previous) {
				if (current === "#tab_plugin_taposmartplug") {
					self.plotEnergyData(false);
				}
			};

		self.cancelClick = function(data) {
			self.processing.remove(data.ip());
		}

		self.editPlug = function(data) {
			self.selectedPlug(data);
			$("#TapoPlugEditor").modal("show");
		}

		self.addPlug = function() {
			self.selectedPlug({'ip':ko.observable(''),
								'label':ko.observable(''),
								'icon':ko.observable('icon-bolt'),
								'username':ko.observable(''),
								'password':ko.observable(''),
								'displayWarning':ko.observable(true),
								'warnPrinting':ko.observable(false),
								'gcodeEnabled':ko.observable(false),
								'gcodeOnDelay':ko.observable(0),
								'gcodeOffDelay':ko.observable(0),
								'autoConnect':ko.observable(true),
								'autoConnectDelay':ko.observable(10.0),
								'autoDisconnect':ko.observable(true),
								'autoDisconnectDelay':ko.observable(0),
								'sysCmdOn':ko.observable(false),
								'sysRunCmdOn':ko.observable(''),
								'sysCmdOnDelay':ko.observable(0),
								'sysCmdOff':ko.observable(false),
								'sysRunCmdOff':ko.observable(''),
								'sysCmdOffDelay':ko.observable(0),
								'currentState':ko.observable('unknown'),
								'btnColor':ko.observable('#808080'),
								'useCountdownRules':ko.observable(false),
								'countdownOnDelay':ko.observable(1),
								'countdownOffDelay':ko.observable(1),
								'emeter':{get_realtime:{}},
								'thermal_runaway':ko.observable(false),
								'event_on_error':ko.observable(false),
								'event_on_disconnect':ko.observable(false),
								'automaticShutdownEnabled':ko.observable(false),
								'event_on_upload':ko.observable(false),
								'event_on_startup':ko.observable(false)});
			self.settings.settings.plugins.taposmartplug.arrSmartplugs.push(self.selectedPlug());
			$("#TapoPlugEditor").modal("show");
		}

		self.removePlug = function(row) {
			self.settings.settings.plugins.taposmartplug.arrSmartplugs.remove(row);
		}

		self.onDataUpdaterPluginMessage = function(plugin, data) {
			if (plugin != "taposmartplug") {
				return;
			}

			if(data.currentState){
				self.updateDictionary(data);
			}

			if(data.check_status){
				self.checkStatus(data.ip);
			}

			if(data.updatePlot && window.location.href.indexOf('taposmartplug') > 0){
				self.plotEnergyData();
			}

			if(data.hasOwnProperty("powerOffWhenIdle")) {
				self.settings.settings.plugins.taposmartplug.powerOffWhenIdle(data.powerOffWhenIdle);

				if (data.type == "timeout") {
					if ((data.timeout_value != null) && (data.timeout_value > 0)) {
						self.timeoutPopupOptions.text = self.timeoutPopupText + data.timeout_value;
						if (typeof self.timeoutPopup != "undefined") {
							self.timeoutPopup.update(self.timeoutPopupOptions);
						} else {
							self.timeoutPopup = new PNotify(self.timeoutPopupOptions);
							self.timeoutPopup.get().on('pnotify.cancel', function() {self.abortShutdown(true);});
						}
					} else {
						if (typeof self.timeoutPopup != "undefined") {
							self.timeoutPopup.remove();
							self.timeoutPopup = undefined;
						}
					}
				}
			}
		};

		function sendNotif(icon, type, text) {
            new PNotify({
                text: text,
                type: type,
                icon: icon
            });
        }

		self.toggleRelay = function(data) {
			self.processing.push(data.ip());
			switch(data.currentState()){
				case "on":
					self.turnOff(data);
					break;
				case "off":
					self.turnOn(data);
					break;
				default:
					self.checkStatus(data.ip());
			}
		}

		self.turnOn = function(data) {
			self.sendTurnOn(data);
		}

		self.sendTurnOn = function(data) {
			sendNotif("icon-refresh icon-spin", "info", "Changing printer status...")
			$.ajax({
				url: API_BASEURL + "plugin/taposmartplug",
				type: "POST",
				dataType: "json",
				data: JSON.stringify({
					command: "turnOn",
					ip: data.ip()
				}),
				contentType: "application/json; charset=UTF-8"
			}).done(function(data){
					self.updateDictionary(data);
					self.processing.remove(data.ip);
					sendNotif("icon-check", "success", "Your printer has turned on successfully!");
				});
		};

		self.turnOff = function(data) {
			if((data.displayWarning() || (self.isPrinting() && data.warnPrinting())) && !$("#TapoSmartPlugWarning").is(':visible')){
				self.selectedPlug(data);
				$("#TapoSmartPlugWarning").modal("show");
			} else {
				$("#TapoSmartPlugWarning").modal("hide");
				self.sendTurnOff(data);
			}
		}; 

		self.sendTurnOff = function(data) {
			sendNotif("icon-refresh icon-spin", "info", "Changing printer status...")
			$.ajax({
			url: API_BASEURL + "plugin/taposmartplug",
			type: "POST",
			dataType: "json",
			data: JSON.stringify({
				command: "turnOff",
				ip: data.ip()
			}),
			contentType: "application/json; charset=UTF-8"
			}).done(function(data){
					self.updateDictionary(data);
					self.processing.remove(data.ip);
					sendNotif("icon-check", "success", "Your printer was turned off successfully...");
				});
		}

		self.plotEnergyData = function(data) {
			if(self.plotted_graph_ip()) {
				$.ajax({
				url: API_BASEURL + "plugin/taposmartplug",
				type: "POST",
				dataType: "json",
				data: JSON.stringify({
					command: "getEnergyData",
					ip: self.plotted_graph_ip(),
					record_limit: self.plotted_graph_records(),
					record_offset: self.plotted_graph_records_offset()
				}),
				cost_rate: self.settings.settings.plugins.taposmartplug.cost_rate(),
				contentType: "application/json; charset=UTF-8"
				}).done(function(data){
						var trace_current = {x:[],y:[],mode:'lines+markers',name:'Current (Amp)',xaxis: 'x2',yaxis: 'y2'};
						var trace_power = {x:[],y:[],mode:'lines+markers',name:'Power (W)',xaxis: 'x3',yaxis: 'y3'}; 
						var trace_total = {x:[],y:[],mode:'lines+markers',name:'Total (kWh)'};
						var trace_cost = {x:[],y:[],mode:'lines+markers',name:'Cost'}

						ko.utils.arrayForEach(data.energy_data, function(row){
							trace_current.x.push(row[0]);
							trace_current.y.push(row[1]);
							trace_power.x.push(row[0]);
							trace_power.y.push(row[2]);
							trace_total.x.push(row[0]);
							trace_total.y.push(row[3]);
							trace_cost.x.push(row[0]);
							trace_cost.y.push(row[3]*self.settings.settings.plugins.taposmartplug.cost_rate());
						});
						var layout = {title:'Tapo Smartplug Energy Data',
									grid: {rows: 2, columns: 1, pattern: 'independent'},
									autosize: true,
									showlegend: false,
									xaxis: {
										showticklabels: false,
										anchor: 'x'
									},
									yaxis: {
										title: 'Total (kWh)',
										hoverformat: '.3f kWh',
										tickangle: 45,
										tickfont: {
											size: 10
										},
										tickformat: '.2f',
										anchor: 'y'
									},
									xaxis2: {
										anchor: 'y2'
									},
									yaxis2: {
										title: 'Current (Amp)',
										hoverformat: '.3f',
										anchor: 'x2',
										tickangle: 45,
										tickfont: {
											size: 10
										},
										tickformat: '.2f'
									},
									xaxis3: {
										overlaying: 'x2',
										anchor: 'y3',
										showticklabels: false
									},
									yaxis3: {
										overlaying: 'y2',
										side: 'right',
										title: 'Power (W)',
										hoverformat: '.3f',
										anchor: 'x3',
										tickangle: -45,
										tickfont: {
											size: 10
										},
										tickformat: '.2f'
									},
									xaxis4: {
										overlaying: 'x',
										anchor: 'y4',
										showticklabels: false
									},
									yaxis4: {
										overlaying: 'y',
										side: 'right',
										title: 'Cost',
										hoverformat: '.3f',
										anchor: 'x4',
										tickangle: -45,
										tickfont: {
											size: 10
										},
										tickformat: '.2f'
									}};
						var options = {
									showLink: false,
									sendData: false,
									displaylogo: false,
									editable: false,
									showTips: false
								};

						var plot_data = [trace_total,trace_current,trace_power,trace_cost/* ,trace_voltage */]
						if(window.location.href.indexOf('taposmartplug') > 0){
							Plotly.react('taposmartplug_energy_graph',plot_data,layout,options);
						}
					});
			}
		}

		self.legend_visible = ko.observable(false);

		self.toggle_legend = function(){
			self.legend_visible(self.legend_visible() ? false : true);
			Plotly.relayout('taposmartplug_energy_graph',{showlegend: self.legend_visible()});
		}

		self.updateDictionary = function(data){
			ko.utils.arrayForEach(self.arrSmartplugs(),function(item){
					if(item.ip() == data.ip) {
						item.currentState(data.currentState);
						if(data.emeter){
							item.emeter.get_realtime = {};
							for (key in data.emeter.get_realtime){
								item.emeter.get_realtime[key] = ko.observable(data.emeter.get_realtime[key]);
							}
							if(data.ip == self.plotted_graph_ip() && window.location.href.indexOf('taposmartplug') > 0){
								self.plotEnergyData();
							}
						}
						self.processing.remove(data.ip);
					}
				});
				//self.dictSmartplugs.removeAll();
				self.dictSmartplugs.pushAll(ko.toJS(self.arrSmartplugs),'ip');
			}

		self.checkStatus = function(plugIP) {
			$.ajax({
				url: API_BASEURL + "plugin/taposmartplug",
				type: "GET",
				dataType: "json",
				data: {checkStatus:plugIP},
				contentType: "application/json; charset=UTF-8"
			}).done(self.updateDictionary);
		}; 

		self.checkStatuses = function() {
			ko.utils.arrayForEach(self.arrSmartplugs(),function(item){
				if(item.ip() !== "") {
					self.processing.push(item.ip());
					self.checkStatus(item.ip());
				}
			});
		};
	}

	OCTOPRINT_VIEWMODELS.push([
		taposmartplugViewModel,
		["settingsViewModel","loginStateViewModel", "filesViewModel"],
		["#navbar_plugin_taposmartplug","#settings_plugin_taposmartplug","#sidebar_plugin_taposmartplug_wrapper","#tab_plugin_taposmartplug","#tab_plugin_taposmartplug_link"]
	]);
});
