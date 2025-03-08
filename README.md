# Archery 2.0

A 2D side-scrolling game built with Phaser.js where you control an archer character who shoots arrows at enemies.

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Edge, Safari)
- A local web server for development (see options below)

### Running the Game

Because the game uses JavaScript modules, you'll need to run it through a local web server rather than opening the HTML file directly.

#### Option 1: Using Python's built-in HTTP server

If you have Python installed, you can run:

```powershell
# Python 3.x
python -m http.server

# Python 2.x
python -m SimpleHTTPServer
```

Then open your browser and navigate to `http://localhost:8000`

#### Option 2: Using Node.js and http-server

If you have Node.js installed:

```powershell
# Install http-server globally if you haven't already
npm install -g http-server

# Run the server
http-server -c-1
```

Then open your browser and navigate to `http://localhost:8080`

#### Option 3: Using Visual Studio Code Live Server extension

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"

## Game Controls

- WASD keys: Move character
- Mouse: Hold and release to charge and shoot arrows

## Project Structure

```
Archery2.0/
├── index.html          # Entry point
├── assets/             # Game assets folder
├── src/                # Source code
│   ├── main.js         # Game initialization
│   ├── scenes/         # Game scenes
│   │   └── GameScene.js # Main game scene
│   └── entities/       # Game entities
│       ├── Hero.js     # Player character
│       └── Arrow.js    # Projectile class
└── README.md           # This file
```

## Development

This project is set up with a minimal structure to get you started. Here are some next steps for development:

1. Add placeholder assets in the `assets/` folder
2. Implement the hero movement and animation in `Hero.js`
3. Implement arrow shooting mechanics in `Arrow.js`
4. Add enemies and collision detection in `GameScene.js`
5. Add score, health, and game UI

## Built With

- [Phaser 3](https://phaser.io/) - The game framework used 