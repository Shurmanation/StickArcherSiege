/**
 * DifficultyScene.js
 * Scene for selecting game difficulty before starting the main game
 */

import gameManager from '../managers/GameManager.js';

export default class DifficultyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DifficultyScene' });
    }
    
    preload() {
        // Future asset preloading
    }
    
    create() {
        // Set background
        this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x2a4d69)
            .setOrigin(0, 0);
        
        // Add title
        this.add.text(
            this.cameras.main.width / 2, 
            100, 
            'Select Difficulty',
            { 
                fontFamily: 'Arial',
                fontSize: 36,
                color: '#ffffff', 
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        
        // Description text
        this.add.text(
            this.cameras.main.width / 2, 
            150, 
            'Choose how challenging your game will be',
            { 
                fontFamily: 'Arial',
                fontSize: 18,
                color: '#dddddd'
            }
        ).setOrigin(0.5);
        
        // Difficulty buttons
        this.createDifficultyButton(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 80,
            'Normal',
            0x4a7b52, // Green
            'Standard gameplay experience',
            () => this.selectDifficulty('normal')
        );
        
        this.createDifficultyButton(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            'Hard',
            0xa36f28, // Orange
            'Stronger enemies and fewer resources',
            () => this.selectDifficulty('hard')
        );
        
        this.createDifficultyButton(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 + 80,
            'Insane',
            0xa32828, // Red
            'Overwhelming challenge for experts',
            () => this.selectDifficulty('insane')
        );
        
        // Back button
        this.createBackButton();
    }
    
    /**
     * Create a difficulty selection button with description
     */
    createDifficultyButton(x, y, text, color, description, callback) {
        // Create button background
        const button = this.add.rectangle(x, y, 260, 60, color)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);
            
        // Add hover effect
        const originalColor = color;
        const highlightColor = Phaser.Display.Color.ValueToColor(color).brighten(20).color;
        
        button.on('pointerover', () => {
            button.fillColor = highlightColor;
        });
        
        button.on('pointerout', () => {
            button.fillColor = originalColor;
        });
        
        // Add button text
        this.add.text(x, y - 10, text, { 
            fontFamily: 'Arial', 
            fontSize: 24, 
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Add description text
        this.add.text(x, y + 15, description, { 
            fontFamily: 'Arial', 
            fontSize: 12, 
            color: '#ffffff'
        }).setOrigin(0.5);
        
        return button;
    }
    
    /**
     * Create a back button to return to the menu
     */
    createBackButton() {
        const button = this.add.rectangle(150, 50, 100, 40, 0x555555)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.scene.start('MenuScene');
            });
            
        button.on('pointerover', () => {
            button.fillColor = 0x777777;
        });
        
        button.on('pointerout', () => {
            button.fillColor = 0x555555;
        });
        
        this.add.text(150, 50, 'Back', { 
            fontFamily: 'Arial', 
            fontSize: 16, 
            color: '#ffffff'
        }).setOrigin(0.5);
    }
    
    /**
     * Handle difficulty selection
     * @param {string} difficulty - The selected difficulty level
     */
    selectDifficulty(difficulty) {
        // Store the selected difficulty in the game manager
        gameManager.setDifficulty(difficulty);
        
        // Show confirmation
        const text = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height - 100,
            `Selected ${difficulty} difficulty. Starting game...`,
            { fontFamily: 'Arial', fontSize: 18, color: '#ffffff' }
        ).setOrigin(0.5);
        
        // Transition to the game scene after a short delay
        this.time.delayedCall(1500, () => {
            this.scene.start('GameScene');
        });
    }
} 