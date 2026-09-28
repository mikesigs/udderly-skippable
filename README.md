# Udderly Skippable

A phone-first rock-skipping shooter in the spirit of NES *Duck Hunt*. Stand on the beach, pocket the flattest rocks you can find, and skip them at the flying cows before their milk blasts push your lactose intolerance to 100%.

Everything lives in one file, `index.html`. Open it on a phone (portrait) and play. No build step, no dependencies beyond two Google Fonts.

## How to play

- **Tap rocks on the beach** to put them in your pocket (holds 8). Flat, palm-sized, mid-weight rocks skip best. The pocket bar shows a star rating, flatness, circumference and weight for the selected rock. Tap a pocket slot to choose which rock you throw next.
- **Swipe up from the rock in your hand** to throw. Start inside the dotted ring around it. Flick speed matters: a quick, clean flick is ideal, a slow push plops, a violent one plunges. The angle of your swipe aims the throw.
- **Swipe sideways anywhere** to step one lane left or right. You stay there until you step again, so move before a milk blast lands.
- Points for every skip, every hit and every downed cow, with a bonus for long skip chains. Cows get tougher and faster each wave.
- At 100% lactose intolerance the game ends and you can enter your name on the local top-10 leaderboard.

## Notes

Aiming by phone tilt was tried and shelved. The code path is still in `index.html` behind the `USE_TILT` flag but it is off, and nothing in the game asks for motion permission.
