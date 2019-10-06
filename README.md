# arena-controller
combat robotics arena controller
This project is a controller for the Robot Ruckus Arena for combat robotics.  This system will be used independently in both the smaller arena and the larger arena, so scalability is key.

No need for desktop/laptop - should be pi/microcontroller based to keep costs down.

## Master Control Panel:
* Start, pause and stop matches
* Sound effects - into arena sound system
* Initialize ready lights
* Indicate ready lights have been pressed
* Arena safety light controls

## Ready buttons:
* One for red driver one for blue driver 
* should be backlit for feedback
* robust arcade button in enclosure, can be bolted/clamped to arena or sit on table
* Simple pluggable wires (i.e. XLR, Cat5…)  this helps with scalability and clean wiring
* Tapout function - once match has started if driver presses button, start flashing other color

## Safety Lights
* Lights at doors and highly visible, could be colors, so red/blue during match green when safe to enter

## Start/stop lights
* For fans and competitors
* RGB for start, linked to safety light colors?
* Could be center bright lights, or string around arena (can we get DMX out to control stage lights?)

## Timers/Displays
* Raspi HDMI for output
* Display match timer full screen
* Maybe link background color into ready lights and safety lights
* Maybe allow team names to be entered (future)
* Load custom logo


