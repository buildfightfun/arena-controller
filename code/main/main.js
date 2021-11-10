//var config = require("./config.js");
const debugMode = true;


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
    if (debugMode) console.log("Dom Ready");
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
player.play('./assets/metronome.mp3');

//--- Set included modules
var eventEmitter = require('events').EventEmitter;
var exec = require('child_process').exec;
var timer = new eventEmitter.EventEmitter();

//--- Set initial constants and variables
var startSeconds = 120; // 3 minutes - Set Timer Length
if (debugMode) startSeconds = 21; // override time for debugging
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
  appState: appStates.LOADIN,
  blinking: false,
  blinkInterval: null,
  blinkingLeds: [],
  redReady: false,
  blueReady: false
};

//--- Initialize the arena
function initializeArena(){

  // Set the current state
  arenaApp.appState = appStates.LOADIN;
  
  // Update the UI
  setAppStateUI(appStates.LOADIN);
  
  // Update the GPIOs
  LoadIn();
 
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
      stopBlink();
      LED_ALL_OFF();
      Standby_LED.writeSync(0); //ON
      arenaApp.blinkingLeds = [eStop_LED];
      startBlink(arenaApp.blinkingLeds);
    }
}

//#endregion

//#region UI private methods    ///////////////////////////////////////////////////////////////////////////////////

//--- Update timer
function updateTimer(){

  // Update the UI
  if(mainWindow !== null) {
    mainWindow.webContents.executeJavaScript(`updateTimer('` + getTimerText() + `')`);
    if(secondsLeft === 15){
      // Start pulsing the timer in the UI
      mainWindow.webContents.executeJavaScript(`setTimerColorEnding()`);
      
      // Start blinking the safety lights white
      arenaApp.blinkingLeds = leds_White;
      startBlink(arenaApp.blinkingLeds);
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
    case appStates.LOADIN:
      // In load in, switch to prematch
      setAppStateUI(appStates.PREMATCH);

      // Make sure the timer is restarted
      secondsLeft = startSeconds;
      updateTimer();

      PreMatch(); // GPIO related code during PreMatch State  
      break;
    
    case appStates.MATCH:
    case appStates.MATCHPAUSED:
    case appStates.PREMATCH:
      // In match, pause timer and set to loag in state
      stopTimer();
      setAppStateUI(appStates.LOADIN);
      app.setUiText("EMERGENCY&nbsp; STOP&nbsp; ENGAGED") // Override the load in text in the UI
      stopBlink(); // Stop any blinking intervals
      arenaApp.blueReady = false;
      arenaApp.redReady = false;
      LoadIn(); // GPIO related code during LoadIn State  
      break;
    case appStates.MATCHFINISHED:
      // In match, pause timer and set to loag in state
      stopTimer();
      setAppStateUI(appStates.LOADIN);
      stopBlink(); // Stop any blinking intervals
      arenaApp.blueReady = false;
      arenaApp.redReady = false;
      LoadIn(); // GPIO related code during LoadIn State  
      break;
  }
}

function startPressed(){
  debugLog("Start pressed");

  switch (arenaApp.appState){
    case appStates.PREMATCH:
    case appStates.MATCHPAUSED:

      // If players ready, switch to match
      if(arenaApp.blueReady && arenaApp.redReady){
        arenaApp.startTimerAfterSound = true;
        playCountdownToFight();
        debugLog("Updating UI Match State");
        setAppStateUI(appStates.MATCH);
        debugLog("Calling Match() gpio method");
        Match(); // GPIO related code during PreMatch State  
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

    // GPIO Related Code
    stopBlink();
    LED_ALL_OFF();
    Start_Button_LED.writeSync(0); // ON
    Reset_Button_LED.writeSync(0); // ON
    InMatch_LED.writeSync(0); // ON
    Standby_LED.writeSync(0); // ON

  }  
}

function resetPressed(){
  debugLog("Reset pressed");

  switch (arenaApp.appState){
    case appStates.LOADIN:
    case appStates.PREMATCH:
    case appStates.MATCHPAUSED:
    case appStates.MATCHFINISHED:
      secondsLeft = startSeconds;
      updateTimer();
      setAppStateUI(appStates.LOADIN);
      LoadIn(); // GPIO state
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
// --- GPIO Setup
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region GPIO Setup

const Gpio = require('onoff').Gpio;

const Start_Button = new Gpio(17, 'in', 'rising', {debounceTimeout: 100});
const Pause_Button = new Gpio(12, 'in', 'rising', {debounceTimeout: 100});
const Reset_Button = new Gpio(27, 'in', 'rising', {debounceTimeout: 100});
const eStop_Button = new Gpio(22, 'in', 'rising', {debounceTimeout: 100});
const Blue_Ready_Button = new Gpio(23, 'in','rising', {debounceTimeout: 100});
const Red_Ready_Button = new Gpio(24, 'in', 'rising', {debounceTimeout: 100});

const MCP_Blue_Ready_LED = new Gpio(25, 'high');
const MCP_Red_Ready_LED = new Gpio(5, 'high');
const Remote_Blue_Ready_LED = new Gpio(4, 'high');
const Remote_Red_Ready_LED = new Gpio(10, 'high');
const Start_Button_LED = new Gpio(16, 'high');
const Pause_Button_LED = new Gpio(20, 'high');
const Reset_Button_LED = new Gpio(21, 'high');
const InMatch_LED = new Gpio(9, 'high');
const eStop_LED = new Gpio(6, 'high');
const Standby_LED = new Gpio(26, 'high');
const WaitForReady_LED = new Gpio(11, 'high');
const rgb_Green_LED = new Gpio(18, 'high');
const rgb_Red_LED = new Gpio(19, 'high');
const rgb_Blue_LED = new Gpio(13, 'high');

//Put all the LED variables in an array
const leds = [Remote_Blue_Ready_LED,MCP_Blue_Ready_LED,MCP_Red_Ready_LED,
  Remote_Red_Ready_LED,Start_Button_LED,Pause_Button_LED,Reset_Button_LED,
  InMatch_LED,eStop_LED,Standby_LED,WaitForReady_LED,
  rgb_Green_LED,rgb_Red_LED,rgb_Blue_LED];

const leds_White = [rgb_Green_LED,rgb_Red_LED,rgb_Blue_LED];
const leds_Purple = [rgb_Red_LED,rgb_Blue_LED];
const leds_Cyan = [rgb_Green_LED,rgb_Blue_LED];

//#endregion

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// --- GPIO Related Functions
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region GPIO Realted Functions

function LED_ALL_OFF(){
  leds.forEach(function(currentValue) { //for each item in array
    currentValue.writeSync(1); //turn off LED
  });
}

function LED_ALL_ON(){
  leds.forEach(function(currentValue) { //for each item in array
    currentValue.writeSync(0); //turn ON LED
  });
}

function LED_Test_Sequence(){
  if (debugMode) {console.log('MCP Start Up Test Started')};
  
  for (i=0;i<2;i++){  
    // turn OFF all LEDs
    LED_ALL_OFF();

    leds.forEach(function(currentValue) {
      currentValue.writeSync(0); // LED ON
      msleep(500); // WAIT 0.5 Seconds    
      currentValue.writeSync(1); // LED OFF
    });
  }
  LED_ALL_ON();
  msleep(2000); // WAIT 2 Seconds    
  LED_ALL_OFF();
}

function unexportOnClose(){
  Start_Button.unexport();      
  Pause_Button.unexport();  
  Reset_Button.unexport();

  LED_ALL_OFF();
}

//#endregion

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// --- GPIO Button Watchers
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region GPIO Button Watchers

eStop_Button.watch((err, value) => {
  if (err) {
    throw err;
  }
  eStopPressed();
});

Start_Button.watch((err, value) => {
  if (err) {
    throw err;
  }
  startPressed();
});

Pause_Button.watch((err, value) => {    
  if (err) {
    throw err;
  }
  pausePressed();
});

Reset_Button.watch((err, value) => {
  if (err) {
    throw err;
  }
  resetPressed();
});

Blue_Ready_Button.watch((err, value) => {
  if (err) {
    throw err;
  }
  blueReadyPressed();
})

Red_Ready_Button.watch((err, value) => {
  if (err) {
    throw err;
  }
  redReadyPressed();
})


//#endregion

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// --- GPIO state functions
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region GPIO state functions

function LoadIn(){
  
  // Set the app state
  arenaApp.appState = appStates.LOADIN;

  LED_ALL_OFF(); // set LEDs to known state which is OFF

  //SAFETY_LIGHT_LOGIC
  //Safety Light = ON
  rgb_Green_LED.writeSync(0); 
  eStop_LED.writeSync(0); //ON
  Reset_Button_LED.writeSync(0); //ON
  Standby_LED.writeSync(0); //ON
  
}

function PreMatch(){
  
  // Set the app state
  arenaApp.appState = appStates.PREMATCH;
  
  LED_ALL_OFF(); // set LEDs to known state which is OFF

  Reset_Button_LED.writeSync(0); //ON
  Standby_LED.writeSync(0); //ON
  WaitForReady_LED.writeSync(0); //ON
  
  // Create array of player ready leds
  debugLog("All player ready leds blinking");
  arenaApp.blinkingLeds = [MCP_Blue_Ready_LED,MCP_Red_Ready_LED,Remote_Blue_Ready_LED,Remote_Red_Ready_LED];
  startBlink(arenaApp.blinkingLeds);

  // Blink the saftey light alternately between blue and red
  startBlueRedAltBlink();

}

function Match(){
  debugLog("In Match() method");

  // Set the app state
  arenaApp.appState = appStates.MATCH;

  stopBlink();

  LED_ALL_OFF(); // set LEDs to known state which is OFF

  if(secondsLeft <= 15){
    // Start blinking the safety lights white
    arenaApp.blinkingLeds = leds_White;
    startBlink(arenaApp.blinkingLeds);
  }        
    

  MCP_Blue_Ready_LED.writeSync(0); //ON
  MCP_Red_Ready_LED.writeSync(0); //ON
  Remote_Blue_Ready_LED.writeSync(0); //ON
  Remote_Red_Ready_LED.writeSync(0); //ON
  InMatch_LED.writeSync(0); //ON
  Pause_Button_LED.writeSync(0); // ON to indicate it is available to use
  Standby_LED.writeSync(1); //OFF 
  WaitForReady_LED.writeSync(1); //OFF
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
  
  // Set GPIO states
  setPlayerGPIOs();

  // Play appropriate sound
  if(playBlueReadyAudio) playBlueReady();
  if(playRedReadyAudio) playRedReady();
 

}

function setPlayerGPIOs(){

  // Stop all blinking
  stopBlink();  
  stopBlueRedAltBlink();

  // Determine if other player needs to continue to blink or go solid on
  if(arenaApp.blueReady === false || arenaApp.redReady === false){
    
    arenaApp.blinkingLeds = [];
    if(arenaApp.blueReady === false){
      debugLog("Blue player blinking");
      arenaApp.blinkingLeds.push(MCP_Blue_Ready_LED);
      arenaApp.blinkingLeds.push(Remote_Blue_Ready_LED);
      arenaApp.blinkingLeds.push(rgb_Blue_LED);
    } else {
      // Not blinking, turn on leds
      debugLog("Blue player solid on");
      MCP_Blue_Ready_LED.writeSync(0); //ON
      Remote_Blue_Ready_LED.writeSync(0); //ON
    }

    if(arenaApp.redReady === false){
      debugLog("Red player blinking");
      arenaApp.blinkingLeds.push(MCP_Red_Ready_LED);
      arenaApp.blinkingLeds.push(Remote_Red_Ready_LED);
      arenaApp.blinkingLeds.push(rgb_Red_LED);
    } else {
      // Not blinking, turn on leds
      debugLog("Red player solid on");
      MCP_Red_Ready_LED.writeSync(0); //ON
      Remote_Red_Ready_LED.writeSync(0); //ON
    }

    // start blinking
    startBlink(arenaApp.blinkingLeds);
    

  } else { // Both players ready, set GPIOs for fight mode
    debugLog("Both players ready")
    
    app.setUiText("ROBOTS&nbsp; READY");

    // Make sure both player ready leds are on
    debugLog("All player ready leds on solid.")
    MCP_Red_Ready_LED.writeSync(0); //ON
    Remote_Red_Ready_LED.writeSync(0); //ON
    MCP_Blue_Ready_LED.writeSync(0); //ON
    Remote_Blue_Ready_LED.writeSync(0); //ON

    // Wait for ready blink   
    arenaApp.blinkingLeds = [WaitForReady_LED,rgb_Blue_LED,rgb_Green_LED,rgb_Red_LED];
    startBlink(arenaApp.blinkingLeds);

    // Start button on
    debugLog("Start button led on");
    Start_Button_LED.writeSync(0); //ON
  }
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

    // Set GPIO state
    LED_ALL_OFF(); // set LEDs to known state which is OFF
      
    rgb_Green_LED.writeSync(0); 
    eStop_LED.writeSync(0); //ON
    Reset_Button_LED.writeSync(0); //ON
    Standby_LED.writeSync(0); //ON  
  }
}

//#endregion

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// --- Blink Functions
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region Blink functions

function startBlink(LEDS) {
  
  debugLog("Starting Blink");

  arenaApp.blinkInterval = setInterval(function(){
    blinkLED(LEDS);   
  }, 500); 
}

function stopBlink(){
  endBlink(arenaApp.blinkingLeds)
}

// Toggle led state
function blinkLED(LEDS) { 
  for (i=0;i<LEDS.length;i++){
    LEDS[i].writeSync(LEDS[i].readSync() ^ 1);
  }
}

// Stop blinking
function endBlink(LEDS) { 
  debugLog("Stopping blinking");
  debugLog(arenaApp.blinkInterval);
  
  // Stop blink interval
  clearInterval(arenaApp.blinkInterval); 

  // Turn off specified leds
  for (i=0;i<LEDS.length;i++){
    LEDS[i].writeSync(1);    
  }  
}


function startBlueRedAltBlink(){
  // Start by turning blue on and red off
  rgb_Blue_LED.writeSync(0); //ON
  rgb_Red_LED.writeSync(1); //OFF
  arenaApp.altBlinkInterval = setInterval(function(){
    // Now swap
    rgb_Blue_LED.writeSync(rgb_Blue_LED.readSync() ^ 1);
    rgb_Red_LED.writeSync(rgb_Red_LED.readSync() ^ 1);
  }, 500);
}

function stopBlueRedAltBlink(){
  // Clear the interval
  clearInterval(arenaApp.altBlinkInterval);

  // Make sure that both leds are off
  rgb_Blue_LED.writeSync(1); //OFF
  rgb_Red_LED.writeSync(1); //OFF
}

//#endregion

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// --- Misc Functions
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//#region Misc methods

function debugLog(msg){
  if(debugMode) console.log(msg);
}

function msleep(n) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}

function sleep(n) {
  msleep(n*1000);
}

//#endregion


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// --- LED Initilization
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
LED_ALL_OFF(); // turn off ALL LEDs to start
//LED_Test_Sequence(); // turn each LED on/off in sequence then flash ALL leds for 2 seconds

// TURN OFF BEFORE PRODUCTION! 

//StartBlink([MCP_Blue_Ready_LED,MCP_Red_Ready_LED,WaitForReady_LED]);
// setTimeout used to SIMULATING A BUTTON CLICK
//setTimeout(function(){stopBlink()}, 5000); //stop blinking after 5 seconds



