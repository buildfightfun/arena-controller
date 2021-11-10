// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const remote = require('electron').remote;

var renderer = {
    timerSkip: false
};

$(document).ready(function () {

    renderer.timerObj = $("#timer");
    renderer.stateObj = $("#state");
    enableStateControls();
    enableSystemControls();

    // Auto hide mouse when not using
    var idleMouseTimer;
    var forceMouseHide = false;
    $("body").css('cursor', 'none');
    $("#wrapper").mousemove(function(ev) {
            if(!forceMouseHide) {
                    $("body").css('cursor', '');

                    clearTimeout(idleMouseTimer);

                    idleMouseTimer = setTimeout(function() {
                            $("body").css('cursor', 'none');

                            forceMouseHide = true;
                            setTimeout(function() {
                                    forceMouseHide = false;
                            }, 200);
                    }, 1000);
            }
    });

});

// Enable system controls
// Set up mouse events
function enableSystemControls(){
    
    // Display/Hide
    var ctrls = $("#systemControls");
    ctrls.on("mouseenter", function(){
        ctrls.animate({opacity: 1}, 300)
    });

    ctrls.on("mouseleave", function(){
        ctrls.animate({opacity: 0}, 500)
    });

    // Button events
    $("#rebootSystem").on("click", function(){
        if(confirm("Reboot System?"))
            rebootSystem();       
    });

    $("#shutdownSystem").on("click", function(){
        if(confirm("Shutdown System?"))
            shutdownSystem();
    });
}


// Enable start/pause/reset controls
// Set up mouse events
function enableStateControls(){
    
    // Display/Hide
    var ctrls = $("#stateControls");
    ctrls.on("mouseenter", function(){
        ctrls.animate({opacity: 1}, 300)
    });

    ctrls.on("mouseleave", function(){
        ctrls.animate({opacity: 0}, 500)
    });

    // Button events
    $("#stateStart").on("click", function(){
        startTimer();       
    });

    $("#statePause").on("click", function(){
        pauseTimer();
    });

    $("#stateReset").on("click", function(){
        resetTimer();
    });

    $("#stateStop").on("click", function(){
        eStop();
    });
}



// --- Methods available to the main process -----------------------------------------------------

// --- Events -------------------------------
function enableTimerControls(){
    
    // Display/Hide
    var ctrls = $("#timerControls");
    ctrls.on("mouseenter", function(){
        ctrls.animate({opacity: 1}, 300)
    });

    ctrls.on("mouseleave", function(){
        
        // Make sure that the timer skip is disabled
        stopTimerSkip();

        // Hide controls
        ctrls.animate({opacity: 0}, 500)
    });

    // Button events
    $("#timerUp").on("click", function(){
        if(renderer.timerSkip === false)
            remote.app.adjustTimer(1);
    });

    $("#timerDown").on("click", function(){
        if(renderer.timerSkip === false)
            remote.app.adjustTimer(-1);
    });

    // Rapid timer adjustments
    $("#timerUp").on("mousedown", function(){
        timerSkip(5);       
    });
    $("#timerDown").on("mousedown", function(){
        timerSkip(-5);       
    });
    $("#timerUp").on("mouseup", function(){
        stopTimerSkip();       
    });
    $("#timerDown").on("mouseup", function(){
        stopTimerSkip();
    });
}

// Skips the timer the specified seconds
function timerSkip(skipVal){
    renderer.mouseTimeout = setTimeout(function(){
        renderer.timerSkip = true;
        renderer.timerSkipInterval = setInterval(function(){
            if(renderer.timerSkip)
                remote.app.adjustTimer(skipVal);
        }, 500)            
    }, 500);
}

// Stops the timer skipping
function stopTimerSkip(){
    clearInterval(renderer.timerSkipInterval);
    clearTimeout(renderer.mouseTimeout);
    renderer.timerSkip = false;
}


// Disable the timer adjustment controls
function disableTimerControls(){
    
    // Display/Hide
    var ctrls = $("#timerControls");
    ctrls.animate({opacity: 0}, 500)
    ctrls.off("mouseenter");
    ctrls.off("mouseleave");

    // Disable button events
    $("#timerUp").off("click");
    $("#timerUp").off("mousedown");
    $("#timerUp").off("mouseup");
    $("#timerDown").off("click");
    $("#timerDown").off("mousedown");
    $("#timerDown").off("mouseup");
}




// --- UI updates ---------------------------------
function updateTimer(timeText){
    if(renderer.timerObj !== undefined)
        renderer.timerObj.html(timeText);
}

function setTimerColorEnding(){
    renderer.timerObj.addClass("white").addClass("pulse");
}

function setTimerStopPulse(){
    renderer.timerObj.removeClass("pulse");
}

function setTimerStartPulse(){
    renderer.timerObj.addClass("pulse");
}

function setTimerColorDefault(){
    renderer.timerObj.removeClass("white");
}

function updateAppState(state){
    if(renderer.stateObj !== undefined)
        renderer.stateObj.html(state);
}


// --- Shared methods ---------------------------------------------------------------------

function shutdownSystem(){
    remote.app.shutdown();
}

function rebootSystem(){
    remote.app.reboot();
}

function startTimer(){
    remote.app.startTimer();
}

function pauseTimer(){
    remote.app.pauseTimer();
}

function resetTimer(){
    remote.app.resetTimer();
}

function eStop(){
    remote.app.eStop();
}


// --- Keyboard shortcuts -------------------------------------------------------------------

// --- Pause / start
Mousetrap.bind('space', function() { 

    var currentState = remote.app.getAppState();
    if(currentState === 3){ // In Match
        pauseTimer();
    } else {
        startTimer();
    }

 });

// --- Red Ready
Mousetrap.bind('r', function() { 
    remote.app.setRedReady();
});

// --- Blue Ready
Mousetrap.bind('b', function() { 
    remote.app.setBlueReady();
});

// --- Reset
Mousetrap.bind('ctrl+x', function() { 
    resetTimer();
});

// --- eStop
Mousetrap.bind('ctrl+s', function() { 
    eStop();
});

// --- Shutdown
Mousetrap.bind('ctrl+shift+q', function() { 
    shutdownSystem();
});

// --- Reload config
Mousetrap.bind('ctrl+c', function() { 
    remote.app.reloadConfig();
});

// --- Reboot
Mousetrap.bind('ctrl+shift+r', function() { 
    rebootSystem();
});
