/**
 * UpgradeScene.js
 * Scene for upgrading between rounds after defeating the enemy base
 * Handles both player and enemy upgrades for the next round
 */

import gameManager from '../managers/GameManager.js';

export default class UpgradeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'UpgradeScene' });
        this.selectedPlayerUpgrade = null;
        this.selectedEnemyUpgrade = null;
    }
    
    init(data) {
        // Get data passed from the previous scene
        this.fromScene = data.fromScene || 'GameScene';
    }
    
    preload() {
        // No assets to preload since we're using geometric shapes
    }
    
    create() {
        // Set background
        this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x1a3d59)
            .setOrigin(0, 0);
        
        // Round header
        this.add.text(
            this.cameras.main.width / 2, 
            30, 
            `Round ${gameManager.currentRound} Complete!`,
            { fontFamily: 'Arial', fontSize: 32, color: '#FFFFFF' }
        ).setOrigin(0.5);
        
        // XP display
        this.add.text(
            this.cameras.main.width / 2, 
            80, 
            `Available XP: ${gameManager.xp}`,
            { fontFamily: 'Arial', fontSize: 24, color: '#FFFF00' }
        ).setOrigin(0.5);
        
        // Instructions
        this.add.text(
            this.cameras.main.width / 2, 
            120, 
            'Select your upgrade, then choose an enemy upgrade',
            { fontFamily: 'Arial', fontSize: 18, color: '#FFFFFF' }
        ).setOrigin(0.5);
        
        // Display player upgrade options
        this.createPlayerUpgradeSection();
        
        // Display enemy upgrade options (will be enabled after player selects their upgrade)
        this.createEnemyUpgradeSection();
        
        // Initially disable enemy upgrade section
        this.enableEnemyUpgradeSection(false);
        
        // Start button (initially disabled, will be enabled after selecting both upgrades)
        this.createStartNextRoundButton();
    }
    
    createStartNextRoundButton() {
        // Create the button rectangle first so we can use it for interactivity
        const x = this.cameras.main.width / 2;
        const y = this.cameras.main.height - 60;
        
        // Create the button background as a separate object that has interactivity
        this.startNextRoundBg = this.add.rectangle(x, y, 240, 60, 0x4477AA)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => this.startNextRoundBg.setFillStyle(0x5588BB))
            .on('pointerout', () => this.startNextRoundBg.setFillStyle(0x4477AA))
            .on('pointerdown', () => this.startNextRound());
            
        // Initially disable the button
        this.startNextRoundBg.disableInteractive();
        this.startNextRoundBg.setAlpha(0.5);
        
        // Add the text over the button
        this.startNextRoundText = this.add.text(
            x, y, 'Start Next Round',
            { fontFamily: 'Arial', fontSize: 20, color: '#FFFFFF' }
        ).setOrigin(0.5);
    }
    
    createPlayerUpgradeSection() {
        // Section title
        this.add.text(
            this.cameras.main.width / 2, 
            170, 
            'Your Upgrades',
            { fontFamily: 'Arial', fontSize: 24, color: '#00FF00' }
        ).setOrigin(0.5);
        
        // Get round-specific player upgrades
        const playerUpgrades = this.getPlayerUpgradesForCurrentRound();
        
        // Create upgrade buttons
        this.playerUpgradeButtons = [];
        
        playerUpgrades.forEach((upgrade, index) => {
            const y = 220 + (index * 80);
            const button = this.createUpgradeButton(
                this.cameras.main.width / 2,
                y,
                upgrade,
                () => this.selectPlayerUpgrade(upgrade.id)
            );
            this.playerUpgradeButtons.push(button);
        });
    }
    
    createEnemyUpgradeSection() {
        // Section title
        const sectionY = this.cameras.main.height / 2 + 30;
        
        this.enemyUpgradeSectionTitle = this.add.text(
            this.cameras.main.width / 2, 
            sectionY, 
            'Enemy Upgrades',
            { fontFamily: 'Arial', fontSize: 24, color: '#FF0000' }
        ).setOrigin(0.5);
        
        // Get round-specific enemy upgrades
        const enemyUpgrades = this.getEnemyUpgradesForCurrentRound();
        
        // Create upgrade buttons
        this.enemyUpgradeButtons = [];
        
        enemyUpgrades.forEach((upgrade, index) => {
            const y = sectionY + 50 + (index * 80);
            const button = this.createUpgradeButton(
                this.cameras.main.width / 2,
                y,
                upgrade,
                () => this.selectEnemyUpgrade(upgrade.id)
            );
            this.enemyUpgradeButtons.push(button);
        });
    }
    
    enableEnemyUpgradeSection(enable) {
        // Set visual state for enemy upgrade section
        this.enemyUpgradeSectionTitle.setAlpha(enable ? 1 : 0.5);
        
        this.enemyUpgradeButtons.forEach(button => {
            const bg = button.bg;
            if (enable) {
                button.setAlpha(1);
                if (bg) bg.setInteractive({ useHandCursor: true });
            } else {
                button.setAlpha(0.5);
                if (bg) bg.disableInteractive();
            }
        });
    }
    
    getPlayerUpgradesForCurrentRound() {
        // For round 1, only offer longbowman training
        if (gameManager.currentRound === 1) {
            return [
                {
                    id: 'unlockLongbowTraining',
                    name: 'Longbowman Training Ground',
                    description: 'Unlock the ability to purchase longbowmen',
                    cost: 200,
                    type: 'xp'
                }
            ];
        }
        
        // Add more round-specific upgrades in the future
        return [];
    }
    
    getEnemyUpgradesForCurrentRound() {
        // For round 1, only offer base health increase
        if (gameManager.currentRound === 1) {
            return [
                {
                    id: 'enemyBaseHealthBoost',
                    name: 'Reinforced Enemy Base',
                    description: 'Enemy base has 20% more health',
                    type: 'enemy'
                }
            ];
        }
        
        // Add more round-specific enemy upgrades in the future
        return [];
    }
    
    createUpgradeButton(x, y, upgrade, callback) {
        // Create a container to group our elements
        const container = this.add.container(x, y);
        
        // Background rectangle with interactivity
        const bg = this.add.rectangle(0, 0, 500, 70, 0x333333)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback)
            .on('pointerover', () => bg.setFillStyle(0x555555))
            .on('pointerout', () => bg.setFillStyle(0x333333));
        
        // Store the background reference directly on the container
        container.bg = bg;
        
        // Title
        const title = this.add.text(
            -230, 
            -15, 
            upgrade.name,
            { fontFamily: 'Arial', fontSize: 20, color: '#FFFFFF' }
        ).setOrigin(0, 0.5);
        
        // Description
        const desc = this.add.text(
            -230, 
            15, 
            upgrade.description,
            { fontFamily: 'Arial', fontSize: 14, color: '#CCCCCC' }
        ).setOrigin(0, 0.5);
        
        // Cost (if applicable)
        let costText = null;
        if (upgrade.cost) {
            const costColor = gameManager.xp >= upgrade.cost ? '#FFFF00' : '#FF6666';
            costText = this.add.text(
                230, 
                0, 
                `${upgrade.cost} XP`,
                { fontFamily: 'Arial', fontSize: 18, color: costColor }
            ).setOrigin(1, 0.5);
        }
        
        // Add all elements to container
        container.add([bg, title, desc]);
        if (costText) container.add(costText);
        
        return container;
    }
    
    selectPlayerUpgrade(upgradeId) {
        // Check if player has enough XP
        const upgrade = this.getPlayerUpgradesForCurrentRound().find(u => u.id === upgradeId);
        if (!upgrade) return;
        
        if (gameManager.xp < upgrade.cost) {
            // Show not enough XP message
            this.showNotEnoughXPMessage();
            return;
        }
        
        // Check if already selected
        if (this.selectedPlayerUpgrade === upgradeId) {
            return; // Already selected this upgrade
        }
        
        // Find the index of the selected upgrade
        const selectedButtonIndex = this.getPlayerUpgradesForCurrentRound().findIndex(u => u.id === upgradeId);
        if (selectedButtonIndex < 0 || !this.playerUpgradeButtons[selectedButtonIndex]) {
            return; // Button not found
        }
        
        // Reset all button colors
        this.playerUpgradeButtons.forEach(button => {
            const bg = button.bg;
            if (bg && bg.setFillStyle) {
                bg.setFillStyle(0x333333);
            }
        });
        
        // Highlight the selected button
        const selectedButton = this.playerUpgradeButtons[selectedButtonIndex];
        if (selectedButton.bg && selectedButton.bg.setFillStyle) {
            selectedButton.bg.setFillStyle(0x008800);
        }
        
        // Set selected upgrade
        this.selectedPlayerUpgrade = upgradeId;
        
        // Enable enemy upgrade section
        this.enableEnemyUpgradeSection(true);
        
        // Apply the upgrade in the game manager
        gameManager.purchaseRoundUpgrade(upgradeId, upgrade.cost);
        
        // Update XP display
        this.updateXPDisplay();
    }
    
    selectEnemyUpgrade(upgradeId) {
        // Find the index of the selected upgrade
        const selectedButtonIndex = this.getEnemyUpgradesForCurrentRound().findIndex(u => u.id === upgradeId);
        if (selectedButtonIndex < 0 || !this.enemyUpgradeButtons[selectedButtonIndex]) {
            return; // Button not found
        }
        
        // Reset all button colors
        this.enemyUpgradeButtons.forEach(button => {
            const bg = button.bg;
            if (bg && bg.setFillStyle) {
                bg.setFillStyle(0x333333);
            }
        });
        
        // Highlight the selected button
        const selectedButton = this.enemyUpgradeButtons[selectedButtonIndex];
        if (selectedButton.bg && selectedButton.bg.setFillStyle) {
            selectedButton.bg.setFillStyle(0x880000);
        }
        
        // Set selected upgrade
        this.selectedEnemyUpgrade = upgradeId;
        
        // Apply the enemy upgrade in the game manager
        gameManager.addEnemyUpgrade(upgradeId);
        
        // Enable the start next round button
        if (this.startNextRoundBg) {
            this.startNextRoundBg.setAlpha(1);
            this.startNextRoundBg.setInteractive({ useHandCursor: true });
        }
        if (this.startNextRoundText) {
            this.startNextRoundText.setAlpha(1);
        }
    }
    
    updateXPDisplay() {
        // Update the XP display text
        const xpText = this.children.list.find(child => 
            child.type === 'Text' && child.text && child.text.includes('Available XP')
        );
        
        if (xpText) {
            xpText.setText(`Available XP: ${gameManager.xp}`);
        }
    }
    
    showNotEnoughXPMessage() {
        const message = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height - 120,
            'Not enough XP!',
            { fontFamily: 'Arial', fontSize: 24, color: '#FF0000' }
        ).setOrigin(0.5);
        
        // Fade out and destroy after 2 seconds
        this.tweens.add({
            targets: message,
            alpha: 0,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => message.destroy()
        });
    }
    
    startNextRound() {
        if (!this.selectedPlayerUpgrade || !this.selectedEnemyUpgrade) {
            return; // Require both selections
        }
        
        // Disable the button to prevent multiple clicks
        if (this.startNextRoundBg) {
            this.startNextRoundBg.disableInteractive();
            this.startNextRoundBg.setAlpha(0.5);
        }
        
        // Advance round in game manager
        gameManager.advanceRound();
        
        // Start the game scene with the new round
        this.scene.start('GameScene');
    }
} 