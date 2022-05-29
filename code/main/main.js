var config = require("./config.json");

//#region Electron initilization    ///////////////////////////////////////////////////////////////////////////////////

// Modules to control application life and create native browser window
const {app, BrowserWindow} = require("electron");
const path = require("path");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    kiosk: true,
    // width: 1500,
    // height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile("index.html");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  console.log("Waiting on dom");

  mainWindow.webContents.once("dom-ready", function() {
    if (config.debugMode) console.log("Dom Ready");
    initializeArena();   
  });
  
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") app.quit();
});

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow();
});

//#endregion

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// --- Main App
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//#region UI setup    ///////////////////////////////////////////////////////////////////////////////////

//--- Set audio player.
var mpg = require('mpg123');
var audioOutput = { name: 'bcm2835 ALSA', address: 'hw:CARD=ALSA,DEV=0' };
var player = new mpg.MpgPlayer(audioOutput, true);
player.on("end", function(){
  debugLog("sound stopped");
  if(arenaApp.startTimerAfterSound){
    startTimer();
    arenaApp.startTimerAfterSound = false;
  }
    
  arenaApp.soundInProgress = false;
});
// Test sound on load
//player.play('./assets/metronome.mp3');

//--- Set included modules
var eventEmitter = require('events').EventEmitter;
var exec = require('child_process').exec;
var timer = new eventEmitter.EventEmitter();

//--- Set initial constants and variables
var startSeconds = config.timer_seconds; // Set Timer Length - This can be changed in the config.json file
if (config.debugMode) startSeconds = 21; // override time for debugging
var secondsLeft = startSeconds;

const appStates = {
  LOADIN: 1,
  PREMATCH: 2,
  MATCH: 3,
  MATCHPAUSED: 4,
  MATCHFINISHED: 5,
  properties: {
    1: {name: 'LOADING&nbsp; IN'},
    2: {name: 'PRE MATCH &nbsp; - &nbsp; ROBOTS&nbsp; GET&nbsp; READY!'},
    3: {name: 'MATCH&nbsp; IN&nbsp; PROGRESS'},
    4: {name: 'MATCH&nbsp; PAUSED'},
    5: {name: 'MATCH&nbsp; FINISHED'}
  }
}

const appPlayers = {
  BLUE: 1,
  RED: 2,
  properties: {
    1: {name: 'BLUE&nbsp; ROBOT&nbsp;'},
    2: {name: 'RED&nbsp; ROBOT&nbsp;'}
  }
}

var arenaApp = {
  startTimerAfterSound: false,
  appState: appStates.PREMATCH,
  redReady: false,
  blueReady: false
};

//--- Initialize the arena
function initializeArena(){

  // Set the current state
  arenaApp.appState = appStates.PREMATCH;
  
  // Update the UI
  setAppStateUI(appStates.PREMATCH);

  // Set the initial time left
  updateTimer();
}


function startTimer(){
  debugLog("Timer started");
  timerTick();
  arenaApp.timer = setInterval(function(){
    timerTick();
  }, 1000);
}

function stopTimer(){
  clearInterval(arenaApp.timer);
  debugLog("Timer stopped");
}

//--- Timer tick
function timerTick(){
  
    // Count down 1 second
    secondsLeft--;
    
    debugLog("Timer tick " + secondsLeft + " seconds left.");

    // Update timer
    updateTimer();

    // Trigger tick event
    timer.emit('tick', secondsLeft);
    
    // Only do this once
    if(secondsLeft === 0){
      player.play('./assets/air-horn.mp3');     
      stopTimer();
      setAppStateUI(appStates.MATCHFINISHED);
      arenaApp.appState = appStates.MATCHFINISHED;
    }
}

//#endregion

//#region UI private methods    ///////////////////////////////////////////////////////////////////////////////////

//--- Update timer
function updateTimer(){

  // Update the UI
  if(mainWindow !== null) {
    mainWindow.webContents.executeJavaScript(`updateTimer('` + getTimerText() + `')`);
    if(secondsLeft === config.timer_end_seconds){
      // Start pulsing the timer in the UI
      mainWindow.webContents.executeJavaScript(`setTimerColorEnding()`);     
    }

    if(secondsLeft === 1)
      mainWindow.webContents.executeJavaScript(`setTimerStopPulse()`);
  }    
  
}

//--- Return the timer text for the seconds remaining
function getTimerText(){
  
  // Create new date object
  var date = new Date(null);

  // Set the seconds
  date.setSeconds(secondsLeft);

  // Convert to string and return just the minutes and seconds
  if(date.getMinutes() < 10)
    return timeString = date.toISOString().substr(15,4);
  
  return timeString = date.toISOString().substr(14,5);
}

//--- Set the state of the app in the UI
function setAppStateUI(state){ // expects an appState
  
  if(mainWindow !== null){
    app.setUiText(appStates.properties[state].name);
  
    switch(state) {
      case appStates.LOADIN:
        mainWindow.webContents.executeJavaScript(`enableTimerControls()`);
        mainWindow.webContents.executeJavaScript(`setTimerColorDefault()`);
        mainWindow.webContents.executeJavaScript(`setTimerStopPulse()`);

        arenaApp.redReady = false;
        arenaApp.blueReady = false;
        break;

      case appStates.PREMATCH:
        mainWindow.webContents.executeJavaScript(`enableTimerControls()`);
        mainWindow.webContents.executeJavaScript(`setTimerColorDefault()`);
        mainWindow.webContents.executeJavaScript(`setTimerStopPulse()`);

        arenaApp.redReady = false;
        arenaApp.blueReady = false;

        break;

      case appStates.MATCH:
        mainWindow.webContents.executeJavaScript(`disableTimerControls()`);
        if(secondsLeft <= 15)
          mainWindow.webContents.executeJavaScript(`setTimerStartPulse()`);      
        break;

      case appStates.MATCHPAUSED:
          mainWindow.webContents.executeJavaScript(`setTimerStopPulse()`);
          break;
    }
  }    
}

//--- Increase/Decrease the timer
app.adjustTimer = function(direction){ // Expects a positive or negative integer

  // Update the seconds
  secondsLeft = secondsLeft + direction;

  // Update the start seconds if applicable
  if((direction === 1 && startSeconds < secondsLeft)
      || (direction === -1 && startSeconds > secondsLeft))
      startSeconds = secondsLeft;
  
  // Update the UI
  updateTimer();
}


//#endregion

//#region System commands    ///////////////////////////////////////////////////////////////////////////////////

app.shutdown = function shutdown(callback){
  exec('sudo shutdown -h now', function(error, stdout, stderr){ callback(stdout); });
}

app.reboot = function reboot(callback){
  exec('sudo shutdown -r now', function(error, stdout, stderr){ callback(stdout); });
}

//#endregion

//#region Methods for updating the UI     ///////////////////////////////////////////////////////////////////////////////////

//--- Start timer
app.startTimer = function(){
  startPressed();
}

//--- Pause timer
app.pauseTimer = function(){
  pausePressed();
}

//--- Reset clock
app.resetTimer = function(){
  resetPressed();
}

//--- eStop
app.eStop = function(){
  eStopPressed();
}

app.setRedReady = function(){
  redReadyPressed();
}

app.setBlueReady = function(){
  blueReadyPressed();
}

app.reloadConfig = function(){
    config = require("./config.json");
}

// --- Sets the text displayed in the UI
app.setUiText = function(text){
  mainWindow.webContents.executeJavaScript(`updateAppState('` + text + `')`);
}

app.getAppState = function(){
  return arenaApp.appState;
}



//#endregion

//#region Methods for playing sounds    ///////////////////////////////////////////////////////////////////////////////////

function playBlueReady(){
  arenaApp.soundInProgress = true;
  player.play('./assets/blue.mp3'); 
}

function playRedReady(){
  arenaApp.soundInProgress = true;
  player.play('./assets/red.mp3');  
}

function playCountdownToFight(){
  arenaApp.playCountdown = true;
  player.play('./assets/321-FIGHT.mp3');
}

function playTapout(){
  arenaApp.soundInProgress = true;
  player.play('./assets/tapout-game.mp3');
}

//#endregion

//#region Button Event Handlers (shared with UI and hardware)    /////////////////////////////////////////////////////////

function eStopPressed(){
  debugLog("eStop pressed");

  switch (arenaApp.appState){    
    case appStates.MATCH:
    case appStates.MATCHPAUSED:
    case appStates.PREMATCH:
      // In match, pause timer and set to loag in state
      stopTimer();
      setAppStateUI(appStates.PREMATCH);
      app.setUiText("EMERGENCY&nbsp; STOP&nbsp; ENGAGED") // Override the load in text in the UI
      stopBlink(); // Stop any blinking intervals
      arenaApp.blueReady = false;
      arenaApp.redReady = false;
      break;
    case appStates.MATCHFINISHED:
      // In match, pause timer and set to loag in state
      stopTimer();
      setAppStateUI(appStates.PREMATCH);
      stopBlink(); // Stop any blinking intervals
      arenaApp.blueReady = false;
      arenaApp.redReady = false;
      break;
  }
}

function startPressed(){
  debugLog("Start pressed");

  switch (arenaApp.appState){
    case appStates.PREMATCH:

    case appStates.MATCH:
      debugLog("function startPressed - appStates.MATCH");
      
      arenaApp.appState = appStates.MATCHPAUSED;
      setAppStateUI(appStates.MATCHPAUSED);
      stopTimer();
  
    case appStates.MATCHPAUSED:

      // If players ready, switch to match
      if(arenaApp.blueReady && arenaApp.redReady){
        arenaApp.startTimerAfterSound = true;
        playCountdownToFight();
        debugLog("Updating UI Match State");
        setAppStateUI(appStates.MATCH);
      }
      break;
  }
}

function pausePressed(){
  debugLog("Pause pressed");
  
  if(arenaApp.appState === appStates.MATCH){
    arenaApp.appState = appStates.MATCHPAUSED;
    setAppStateUI(appStates.MATCHPAUSED);
    stopTimer();
  }  
}

function resetPressed(){
  debugLog("Reset pressed");

  initializeArena();

  switch (arenaApp.appState){
    //case appStates.LOADIN:
    case appStates.PREMATCH:
    case appStates.MATCHPAUSED:
    case appStates.MATCHFINISHED:
      secondsLeft = startSeconds;
      updateTimer();
      setAppStateUI(appStates.PREMATCH);
      break;
  }
}

function blueReadyPressed(){
  debugLog("Blue Ready Pressed");
  
  switch (arenaApp.appState){
    case appStates.PREMATCH:
      playerReady(appPlayers.BLUE);
      break;
    case appStates.MATCH:
      playerTapout(appPlayers.BLUE);
      break;
  }  
}

function redReadyPressed(){
  debugLog("Red Ready Pressed");
    
  switch (arenaApp.appState){
    case appStates.PREMATCH:
      playerReady(appPlayers.RED);
      break;
    case appStates.MATCH:
      playerTapout(appPlayers.RED);
      break;
  }
}




//#endregion

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// --- GPIO state functions
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region GPIO state functions

function PreMatch(){  
  // Set the app state
  debugLog("In PreMatch() method");

  arenaApp.appState = appStates.PREMATCH;
}

function Match(){
  debugLog("In Match() method");

  // Set the app state
  arenaApp.appState = appStates.MATCH;
}

// Sets the GPIO state for when a player is ready
function playerReady(player){
  debugLog("playerReady method called");

  var playBlueReadyAudio = false;
  var playRedReadyAudio = false;
  
  // Determine which player is ready
  switch (player){
    case appPlayers.BLUE:
      if(arenaApp.blueReady === false){
        arenaApp.blueReady = true;
        playBlueReadyAudio = true;
      }      
      break;
    case appPlayers.RED:
      if(arenaApp.redReady === false){
        arenaApp.redReady = true;
        playRedReadyAudio = true;
      }      
      break;
  }

  // Play appropriate sound
  if(playBlueReadyAudio) playBlueReady();
  if(playRedReadyAudio) playRedReady();
 

}

function playerTapout(player){

  // Only allow tapout if in match
  if(arenaApp.appState === appStates.MATCH){
    // Pause the timer
    stopTimer();

    // Play sound
    playTapout();

    // Update the UI
    arenaApp.appState = appStates.MATCHFINISHED;

    // Update the ui text
    app.setUiText(appPlayers.properties[player].name + " TAPPED&nbsp; OUT!")

  }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// --- Misc Functions
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region Misc methods

function debugLog(msg){
  if(config.debugMode) console.log(msg);
}

function msleep(n) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}

function sleep(n) {
  msleep(n*1000);
}

//#endregion