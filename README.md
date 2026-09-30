# Udderly Skippable

A phone-first rock-skipping shooter in the spirit of NES *Duck Hunt*. Stand on the beach, pocket the flattest rocks you can find, and skip them at the flying cows before their milk blasts push your lactose intolerance to 100%.

Everything lives in one file, `index.html`. Open it on a phone (portrait) and play. No build step, no dependencies beyond two Google Fonts.

## How to play

- **Tap rocks on the beach** to put them in your pocket (holds 8). Flat, palm-sized, mid-weight rocks skip best. The pocket bar shows a star rating, flatness, circumference and weight for the selected rock. Tap a pocket slot to choose which rock you throw next.
- **Flick from the rock in your hand** to throw. Any flick that starts inside the dotted ring throws, and its direction aims the rock. Flick speed matters: a quick, clean flick is ideal, a slow push plops, a violent one plunges.
- **Swipe sideways outside the ring** to step one lane left or right. You stay there until you step again, so move before a milk blast lands.
- Points for every skip, every hit and every downed cow, with a bonus for long skip chains. Cows get tougher and faster each wave.
- At 100% lactose intolerance the game ends and you can enter your name on the local top-10 leaderboard.
- **PAUSE** in the top-left corner (or the Escape or P key) opens a menu with resume, restart and quit to title. The game also pauses itself when the app goes to the background.
- **Practice** from the title screen is the same beach with no cows, for working on your skip chain. The HUD tracks your best chain instead of a wave and lactose meter.

## Credits

- Cow moo: ["Single Cow Moo"](https://commons.wikimedia.org/wiki/File:Single_Cow_Moo.ogg) by MichaeltheFox8621, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), via Wikimedia Commons. Trimmed, mixed to mono and downsampled to 11 kHz 8-bit for embedding in `index.html`. Under the share-alike term, that modified clip remains CC BY-SA 4.0.
- Every other sound is synthesized in Web Audio at runtime.

## Notes

Aiming by phone tilt was tried and shelved. The code path is still in `index.html` behind the `USE_TILT` flag but it is off, and nothing in the game asks for motion permission.
