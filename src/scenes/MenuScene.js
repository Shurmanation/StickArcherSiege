/**
 * MenuScene.js
 * Main menu scene with New Game and Continue Game options
 */

import gameManager from '../managers/GameManager.js';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }
    
    preload() {
        // Future preloading of assets
        // this.load.image('menu-background', 'assets/menu-bg.png');
        // this.load.image('logo', 'assets/logo.png');
    }
    
    create() {
        // Set background
        this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x2a4d69)
            .setOrigin(0, 0);
        
        // Add game title
        this.add.text(
            this.cameras.main.width / 2, 
            100, 
            'Archery 2.0',
            { 
                fontFamily: 'Arial',
                fontSize: 48,
                color: '#ffffff', 
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // Create menu buttons
        this.createMenuButton(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 40,
            'New Game',
            () => this.startNewGame()
        );
        
        this.createMenuButton(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 40,
            'Continue Game',
            () => this.continueGame()
        );
    }
    
    /**
     * Helper method to create styled buttons
     */
    createMenuButton(x, y, text, callback) {
        // Create button background
        const button = this.add.rectangle(x, y, 200, 50, 0x4a6fa5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);
            
        // Add hover states
        button.on('pointerover', () => {
            button.fillColor = 0x6889b5;
        });
        
        button.on('pointerout', () => {
            button.fillColor = 0x4a6fa5;
        });
        
        // Add text
        this.add.text(x, y, text, { 
            fontFamily: 'Arial', 
            fontSize: 20, 
            color: '#ffffff'
        }).setOrigin(0.5);
        
        return button;
    }
    
    /**
     * Handle New Game button click
     */
    startNewGame() {
        // Reset game state
        gameManager.resetGame();
        
        // Transition to difficulty selection
        this.scene.start('DifficultyScene');
    }
    
    /**
     * Handle Continue Game button click 
     * Currently a placeholder for future save/load functionality
     */
    continueGame() {
        console.log('Continue Game not implemented yet');
        
        // Display a notification to the user
        const text = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height - 100,
            'Continue Game not implemented yet',
            { fontFamily: 'Arial', fontSize: 16, color: '#ff0000' }
        ).setOrigin(0.5);
        
        // Fade out the notification
        this.tweens.add({
            targets: text,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
} 