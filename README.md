# Udderly Skippable

Skip rocks at milk-spraying flying cows on a bright, stylized 3D lakeshore. Built for phones in portrait.

The game loop: pocket the flattest rocks you can find on the beach, flick them so they skip across the water, time the skips to hit the cows, and step aside before a milk blast lands. Every hit raises your score. Every milk blast raises your lactose intolerance. At 100% you're done.

## Project layout

```
index.html              Vite entry page: HUD, screens, pocket bar
src/main.js             Boots the world, game, input and UI; runs the frame loop
src/game/game.js        Rules, entities, scoring, waves, cows, blasts, rocks
src/game/input.js       Gestures: flick inside the ring to throw, swipe outside to step, tap to pick
src/game/rocks.js       Rock model (flatness, size, weight) and 2D pocket icons
src/render/world.js     Three.js scene: sky, sun, water shader, beach, forest, mountains, clouds
src/render/cow.js       Cow model factory (toon-shaded primitives) and animation
src/render/rockmesh.js  Faceted 3D rocks from rock stats
src/render/fx.js        Splash rings, droplets, sand puffs, milk blasts, aim guide
src/audio/sfx.js        Synthesized effects, ambient water, moo voices
src/audio/moo-sample.js Embedded cow recording (see Credits)
src/ui/ui.js            HUD, pocket, messages, screens, leaderboard, settings
public/                 Icons and web manifest
android/                Capacitor Android project
prototype/index.html    The original single-file 2D prototype, kept for reference
```

## Run it

```
npm install
npm run dev          # local dev server
npm run build        # production build into dist/
npm run build:single # one self-contained HTML file in dist-single/ (what the shared play link uses)
```

## Android

The Android app is a [Capacitor](https://capacitorjs.com) wrapper around the web build. Locally, with Android Studio installed:

```
npm run android:sync   # builds the web app and copies it into android/
npm run android:open   # opens the project in Android Studio
```

GitHub Actions builds it on every push (`.github/workflows/android.yml`) and uploads two artifacts: a debug APK you can sideload, and an unsigned release AAB. To publish on Google Play you sign the AAB with your upload key, either in Android Studio or by adding a `signingConfigs` block to `android/app/build.gradle` fed from repository secrets.

Play Store checklist still to do: app signing key, store listing screenshots, privacy policy URL (the game stores scores and settings locally only, no network calls), content rating questionnaire.

## How to play

- **Tap rocks** on the beach to pocket them, up to eight. Flat, palm-sized, mid-weight rocks skip best. The pocket bar rates each rock.
- **Flick from the rock in your hand**, anywhere inside the dotted ring, to throw. The direction of the flick aims. A quick, clean flick is ideal: too soft plops, too hard plunges.
- **Swipe sideways outside the ring** to step one lane left or right. You stay there until you step again.
- Cows glow before they spray. If the blast lands on your lane your lactose intolerance climbs. Dodge it for bonus points.
- Four kinds of cow: regular, bull (tough, slow, deep voice), calf (fast, fragile, high voice) and the old grey one.
- **Practice** mode is the same lake with no cows.

## Credits

- Cow moo: ["Single Cow Moo"](https://commons.wikimedia.org/wiki/File:Single_Cow_Moo.ogg) by MichaeltheFox8621, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), via Wikimedia Commons. Trimmed, mixed to mono and downsampled to 11 kHz 8-bit for embedding; the modified clip remains CC BY-SA 4.0. The four cow voices are this recording at different playback rates and tone.
- Every other sound is synthesized in Web Audio at runtime.
- Built with [Three.js](https://threejs.org), [Vite](https://vitejs.dev) and [Capacitor](https://capacitorjs.com).
