# ARENITA 🏖️

![arenita banner](arenita.png)

![built on a plane](https://badgen.net/badge/built/on%20a%20plane/blue)
![license](https://badgen.net/badge/license/BSD-3/green)
![vanilla js](https://badgen.net/badge/vanilla/js%20only/yellow)
![no build step](https://badgen.net/badge/build%20step/absolutely%20not/red)
![vibes](https://badgen.net/badge/vibes/immaculate/purple)
![sand](https://badgen.net/badge/sand/physics/orange)

> tetris but make it sandy. the pieces disintegrate bestie. ✨

## ok so what even IS this 🤔

you know tetris right. ok so it's that but when the pieces land they **fall apart into sand** 🪨 and the sand does sand things (flows, piles up, settles). and instead of clearing rows you gotta get the same-colored sand to touch BOTH walls at the same time like a little sandy bridge. then it explodes 💥. it's literally so satisfying i cannot explain it to you.

i called it **arenita** which means "little sand" in spanish 🇪🇸 because i took two years of spanish in high school and retained exactly one (1) word.

## origin story (lore) ✈️

i was on a transatlantic flight. somewhere over the atlantic ocean 🌊. bored out of my mind. no wifi. just me, a laptop 💻, and the audacity to vibe-code a physics-based tetris clone at 35,000 feet. no libraries. no build tools. just vanilla js and pure delusion. this is the result.

## how to play 🎮

```sh
python3 -m http.server 8765
# open http://localhost:8765 and go off
```

that's it. that's the whole installation 🎉. no npm install. no node_modules folder eating your soul. just a python server you already have.

if you're even lazier (valid):

```sh
chmod +x start.sh  # once, just once, you can do it
./start.sh
```

does the same thing but you don't have to remember the port number like some kind of nerd.



## controls 🕹️

### 1 player (either works, we don't gatekeep)

| what | wasd | arrows |
|------|------|--------|
| move | A / D | ← / → |
| soft drop | S | ↓ |
| hard drop | W | ↑ |
| rotate cw | E | — |
| rotate ccw | Q | — |
| hold | shift | — |

### 2 players (couch co-op but make it competitive) 🤼

p1 gets wasd, p2 gets arrows. fight for your life ⚔️.

### global

| esc | pause (takes a breath 😮‍💨) |
|-----|------------------------|
| R | back to menu (from game over screen) |

## difficulty 🌡️

when you start a game it asks you how unhinged you want the colors to be:

- 🟢 **easy** — 3 colors. very chill. the sand basically clears itself. good for showing off to people who've never seen this before.
- 🟡 **medium** — 5 colors. this is the sweet spot. you gotta actually think.
- 🔴 **hard** — 7 colors. godspeed. the sand is chaotic. you will suffer beautifully.

## game mechanics (for the nerds) 🤓

- 🎨 pieces spawn with a **random color** from the difficulty pool — no more "green is always S piece" nonsense
- 💀 when a piece locks it **literally disintegrates** into individual sand grains that fall under gravity
- 🔬 sand simulation runs at **2× resolution** (20×40 grid) so grains slip through gaps realistically
- 🌉 clears trigger when a **same-color connected blob spans both walls** — not rows, BLOBS
- ⛓️ chain clears are a thing. get good.
- 😈 2p sends garbage to opponents. the garbage is gray. gray sand cannot be cleared. evil.

## tech stack 🛠️

```
index.html          one file. just the one. 📄
src/
  main.js           rAF loop
  game.js           state machine
  player.js         piece physics + scoring
  board.js          owns the sand grid
  tetromino.js      SRS rotation, 7-bag, color pool
  sand.js           cellular automata (the cool part) ⭐
  renderer.js       ImageData fast path (no fillRect spam)
  input.js          DAS/ARR keyboard handling
  audio.js          synthesized sfx via Web Audio API (no files)
```

zero dependencies. zero build steps. zero regrets (some regrets) 🫠.

## disclaimer ⚠️

some of this readme was written by an AI and contains inaccuracies. i noticed. i left them in. accuracy is a vibe and the vibe was off. the spirit is true even if the details aren't. you'll figure it out.

## license 📜

BSD-3. attribution please, it's not a lot to ask 🙏. full terms in [LICENSE](LICENSE).
