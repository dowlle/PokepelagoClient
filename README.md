# Pokepelago Client

Welcome to the **Pokepelago Client**, the companion React web application for the Archipelago Pokepelago APWorld!

This client allows you to visually track your progress, track your caught Pokémon, and interact with the Archipelago multiworld server in a highly polished, interactive Pokédex interface.

## Features

- **Archipelago Integration**: Connects directly to any Archipelago server using `archipelago.js`. 
- **Real-time Sync**: Instantly receives items, type keys, and updates your Pokédex as you progress through your seed.
- **Smart Logic Validations**: Prevents you from guessing Pokémon you haven't mathematically unlocked yet (e.g., requires specific Type Keys).
- **Responsive Design**: Includes a masonry-style Pokédex or a traditional grid. 
- **Visual Flourishes**: Features shiny variations, hints, and dynamic unlocking animations.

## Setup & Installation

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dowlle/PokepelagoClient.git
   cd PokepelagoClient
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Build for production**:
   ```bash
   npm run build
   ```

## How to Play

1. Start your Archipelago Server with the Pokepelago `.apworld` generated seed.
2. Open the Pokepelago Client in your browser.
3. Enter your **Hostname**, **Port**, and **Slot Name** (e.g., `AshKetchum`) in the connection prompt.
4. Once connected, your `Oak's Lab` starting items will automatically sync.
5. Use the input bar at the bottom to "guess" Pokémon names. 
6. As you guess Pokémon and receive items from the multiworld, more Pokémon will become catchable!

## Debugging

The client includes an auto-guesser script designed for testing seed mathematically. You can activate it by enabling the Debug Controls in the UI settings or using the custom debug triggers.

---

### Contributing

Feel free to open issues or submit pull requests if you want to improve the client's UI or add new tracking features!
