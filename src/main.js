/**
 * Main entry point for the Archery 2.0 game
 * Initializes Phaser and configures the game
 */

import GameScene from './scenes/GameScene.js';
import MenuScene from './scenes/MenuScene.js';
import DifficultyScene from './scenes/DifficultyScene.js';
import gameManager from './managers/GameManager.js';

// Game configuration
const config = {
    type: Phaser.CANVAS, // Force CANVAS renderer for better input compatibility
    width: 800,
    height: 600,
    parent: 'game-container', // Specify the parent element
    backgroundColor: '#4488AA', // Set a default background color
    render: {
        pixelArt: false,
        antialias: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 900 },
            debug: false // Disable physics debug to hide collision boxes
        }
    },
    input: {
        activePointers: 3,  // Increase from 1 to 3 for better input detection
        keyboard: true,
        mouse: true,      // Explicitly enable mouse
        touch: true       // Enable touch for mobile
    },
    scene: [MenuScene, DifficultyScene, GameScene] // Start with the menu scene
};

// Initialize the game
try {
    const game = new Phaser.Game(config);
    
    // Keep game instance on window for access from other components
    window.game = game;
    
    // Store game manager globally for easy access
    window.gameManager = gameManager;
    
    // Ensure canvas has focus for keyboard events
    setTimeout(() => {
        const canvas = document.querySelector('#game-container canvas');
        if (canvas) {
            canvas.tabIndex = 1;
            canvas.focus();
        }
    }, 500);
} catch (e) {
    console.error('Game initialization error:', e);
} 