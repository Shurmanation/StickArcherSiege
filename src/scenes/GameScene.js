/**
 * GameScene.js
 * Main game scene that handles the gameplay logic
 */

import Hero from '../entities/Hero.js';
import Base from '../entities/Base.js';
import Troop from '../entities/Troop.js';
import gameManager from '../managers/GameManager.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // Game world constants
        this.WORLD_WIDTH = 2000;
        this.WORLD_HEIGHT = 600;
        this.GROUND_HEIGHT = 60;
        this.GROUND_Y = 570;
        
        // Game object references
        this.hero = null;
        this.platforms = null;
        this.playerBase = null;
        this.enemyBase = null;
        this.keys = null;
        this.arrows = []; // Initialize as empty array
        this.troops = []; // Initialize troops array
        
        // Game state
        this.worldBounds = { width: this.WORLD_WIDTH, height: this.WORLD_HEIGHT }; // Wider world for sidescrolling
        this.gameActive = true; // Flag to track if the game is still active
        
        // Background effects
        this.stars = []; // Array to store star objects
        this.starLayers = []; // Array to store star layers for parallax
    }

    preload() {
        // No assets to preload for placeholder graphics
    }

    create() {
        // Set up game world - explicitly set background color and bounds
        this.cameras.main.setBackgroundColor('#4488AA');
        
        // Set physics world bounds to our wider world
        this.physics.world.setBounds(0, 0, this.worldBounds.width, this.worldBounds.height);
        
        // Initialize arrays
        this.arrows = [];
        this.troops = [];
        
        // Create stars in the background for parallax effect
        this.createStars();
    
        // Create ground
        this.createGround();
        
        // Create player and enemy bases
        this.createBases();
        
        // Initialize hero at x=200, y=450 (near player base)
        this.hero = new Hero(this, 200, 400);
        
        // Set up camera to follow hero with offset and deadzone
        this.setupCamera();
        
        // Set up collisions after hero is fully initialized
        this.setupCollisions();
        
        // Set up input controls (keyboard, mouse, etc.)
        this.setupInputs();
        
        // Create hero health bar
        this.createHeroHealthBar();
        
        // Setup economy display and systems
        this.setupEconomySystem();
        
        // After everything is set up, update UI elements based on game state
        this.updateBasedOnGameState();
    }

    update(time, delta) {
        try {
            // Skip update if game is not active
            if (!this.gameActive) return;
            
            // Get player input and update hero
            if (this.hero && this.keys) {
                this.hero.update(this.keys);
            }
            
            // Update UI
            this.updateUI();
            
            // Use star parallax if available
            if (typeof this.updateStarParallax === 'function') {
                this.updateStarParallax();
            }
            
            // Update troop movements
            this.updateTroops(delta);
            
            // Clean up arrows that are out of bounds
            if (typeof this.cleanupArrows === 'function') {
                this.cleanupArrows();
            }
            
            // Update gold display if it exists
            this.updateGoldDisplay();
            
            // Update XP display if it exists
            this.updateXPDisplay();
        } catch (error) {
            console.warn("Error in update method:", error);
        }
    }
    
    /**
     * Create simple stars in the background for parallax effect
     */
    createStars() {
        // Create three layers of stars with different parallax speeds
        const layerCount = 3;
        const starsPerLayer = 50;
        const maxStarHeight = this.WORLD_HEIGHT * 0.7; // Only place stars in the top 70% of the screen
        
        for (let layer = 0; layer < layerCount; layer++) {
            // Create a container for this layer
            const starLayer = this.add.container(0, 0);
            starLayer.depth = -20 - layer; // Ensure stars are behind clouds
            
            // Calculate parallax factor (deeper layers move slower)
            // Using very small values for extremely subtle movement
            const parallaxFactor = 0.02 + (layer * 0.01); // 0.02, 0.03, 0.04
            starLayer.parallaxFactor = parallaxFactor;
            
            // Add stars to this layer
            for (let i = 0; i < starsPerLayer; i++) {
                // Randomize star position across the entire world
                const x = Math.random() * this.WORLD_WIDTH;
                const y = Math.random() * maxStarHeight; // Keep stars in upper part of screen
                
                // Create a simple star (small circle)
                const size = 1 + Math.random() * (3 - layer * 0.5); // Smaller stars in deeper layers
                const brightness = 0.5 + Math.random() * 0.5; // Random brightness
                const color = layer === 0 ? 0xFFFFFF : 0xDDDDDD; // Brighter stars in front layer
                
                const star = this.add.circle(x, y, size, color, brightness);
                
                // Add slight twinkle effect to some stars
                if (Math.random() > 0.7) {
                    this.tweens.add({
                        targets: star,
                        alpha: 0.3 + Math.random() * 0.5,
                        duration: 1000 + Math.random() * 2000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
                
                // Add star to the layer
                starLayer.add(star);
            }
            
            // Store the layer
            this.starLayers.push(starLayer);
        }
    }
    
    /**
     * Update star positions for parallax effect
     */
    updateStarParallax() {
        // Get camera position
        const cameraX = this.cameras.main.scrollX;
        
        // Update each star layer
        this.starLayers.forEach(layer => {
            // Calculate offset based on parallax factor
            const offsetX = -cameraX * layer.parallaxFactor;
            layer.x = offsetX;
        });
    }
    
   
    // Helper method to add arrows to the management array
    addArrowToScene(arrow) {
        if (arrow && arrow.active) {
            // Add to tracking array
            this.arrows.push(arrow);
            
            // Set up collision with enemy base using overlap
            if (this.enemyBase && this.enemyBase.sprite) {
                this.physics.add.overlap(arrow, this.enemyBase.sprite, 
                    (arrowSprite, baseSprite) => {
                        const arrowObj = arrowSprite.arrowInstance;
                        
                        // Call the arrow's hitBase method if it exists
                        if (arrowObj && typeof arrowObj.hitBase === 'function') {
                            arrowObj.hitBase(arrowSprite, baseSprite);
                        } else {
                            // Log warning for debugging
                            console.warn('Arrow missing hitBase method, using Base.onArrowHit fallback');
                            
                            // Fallback to static method if it exists
                            if (typeof Base.onArrowHit === 'function') {
                                Base.onArrowHit(baseSprite, arrowSprite);
                            } else {
                                console.error('Neither Arrow.hitBase nor Base.onArrowHit methods exist');
                            }
                        }
                    },
                    null, this);
            }
            
            // Set up collision with enemy troops
            this.setupArrowTroopCollision(arrow);
            
            // Set up collision with player base (for enemy arrows in the future)
            if (this.playerBase && this.playerBase.sprite) {
                this.physics.add.overlap(arrow, this.playerBase.sprite, 
                    (arrowSprite, baseSprite) => {
                        const arrowObj = arrowSprite.arrowInstance;
                        
                        // Only process if this is an enemy arrow (for future use)
                        if (arrowObj && arrowObj.options && arrowObj.options.isEnemyArrow) {
                            // Call the arrow's hitBase method if it exists
                            if (typeof arrowObj.hitBase === 'function') {
                                arrowObj.hitBase(arrowSprite, baseSprite);
                            } else if (typeof Base.onArrowHit === 'function') {
                                Base.onArrowHit(baseSprite, arrowSprite);
                            }
                        }
                    },
                    null, this);
            }
            
            // NOTE: Intentionally NOT adding collision with platforms
            // Arrows should pass through platforms completely
        }
    }
    
    /**
     * Set up collision detection between the given arrow and enemy troops
     * @param {Phaser.GameObjects.GameObject} arrow - The arrow to check collisions for
     */
    setupArrowTroopCollision(arrow) {
        // Skip if no troops in the scene
        if (!this.troops || this.troops.length === 0) return;
        
        // Check for enemy troops in the scene
        for (const troop of this.troops) {
            // Skip if troop is not an enemy or doesn't have a sprite
            if (!troop.isEnemy || !troop.sprite || !troop.sprite.active) continue;
            
            // Set up collision between arrow and enemy troop
            this.physics.add.overlap(arrow, troop.sprite, 
                (arrowSprite, troopSprite) => {
                    const arrowObj = arrowSprite.arrowInstance;
                    
                    // Call the arrow's hitEnemy method if it exists
                    if (arrowObj && typeof arrowObj.hitEnemy === 'function') {
                        arrowObj.hitEnemy(arrowSprite, troopSprite);
                    }
                },
                null, this);
        }
    }

    cleanupArrows() {
        if (!this.arrows || this.arrows.length === 0) {
            return;
        }
        
        const margin = 50; // Extra margin beyond screen
        
        // Filter out arrows that are outside the world bounds
        this.arrows = this.arrows.filter(arrow => {
            if (!arrow || !arrow.active) {
                return false;
            }
            
            // Check if arrow is out of bounds (with margin)
            const outOfBounds = (
                arrow.x < -margin ||
                arrow.y < -margin ||
                arrow.x > this.worldBounds.width + margin ||
                arrow.y > this.worldBounds.height + margin
            );
            
            // If out of bounds, destroy the arrow
            if (outOfBounds) {
                arrow.destroy();
                return false;
            }
            
            // Check if arrow has existed for too long (10 seconds)
            const arrowLifetime = Date.now() - arrow.creationTime;
            if (arrowLifetime > 10000) {
                arrow.destroy();
                return false;
            }
            
            // Keep the arrow in the active list
            return true;
        });
    }
    
    /**
     * Display "Max!" text when a perfect power shot is fired
     * @param {number} x - X position to show the text
     * @param {number} y - Y position to show the text
     */
    showMaxPowerText(x, y) {
        // Start position higher above player's head
        const startY = y - 30;
        
        // Choose 1 of 5 random horizontal positions for variety
        const offsetOptions = [-30, -15, 0, 15, 30];
        const randomOffset = offsetOptions[Math.floor(Math.random() * offsetOptions.length)];
        const startX = x + randomOffset;
        
        // Create the "Max!" text
        const maxText = this.add.text(startX, startY, 'Max!', {
            font: '18px Arial',
            fill: '#cc00cc',
            stroke: '#ffffff',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        // Add animation to float up and fade out
        this.tweens.add({
            targets: maxText,
            y: startY - 50, // Float upward
            alpha: 0,       // Fade out
            duration: 1000, // Over 1 second
            ease: 'Linear',
            onComplete: () => {
                maxText.destroy(); // Clean up when done
            }
        });
    }
    
    /**
     * Display damage indicator when an entity takes damage
     * @param {number} x - X position of the damaged entity
     * @param {number} y - Y position of the damaged entity
     * @param {number} amount - Amount of damage dealt
     * @param {boolean} isHero - Whether the damaged entity is the hero
     */
    showDamageIndicator(x, y, amount, isHero = false) {
        if (isNaN(amount) || amount <= 0) return;
        
        // Different styling for hero vs enemies
        const textStyle = isHero ? 
            {
                fontSize: '16px',
                fill: '#ff0000',
                stroke: '#000000',
                strokeThickness: 2
            } : 
            {
                fontSize: '14px',
                fill: '#000000',
                stroke: '#000000',
                strokeThickness: 1
            };
        
        const damageText = this.add.text(x, y - 40, `-${Math.round(amount)}`, textStyle)
            .setOrigin(0.5, 0.5);
        damageText.setDepth(30); // Ensure it's above entities
        
        // Animation is the same for both types
        this.tweens.add({
            targets: damageText,
            y: y - 40,
            alpha: 0,
            duration: 1000,
            onComplete: () => damageText.destroy()
        });
    }
    /**
     * Create player and enemy bases
     */
    createBases() {
        // Create player base on the left
        this.playerBase = new Base(this, 100, this.GROUND_Y - 80, {
            isPlayerBase: true,
            color: 0x3333FF,
            health: 300,
            maxHealth: 300,
            width: 80,
            height: 150
        });
        
        // Create enemy base on the right
        let enemyBaseHealth = 300; // Base health amount
        
        // Apply enemy upgrades if they exist
        const enemyUpgradeEffects = gameManager.getEnemyUpgradeEffects();
        if (enemyUpgradeEffects.enemyBaseHealthBoost) {
            // Apply health boost (e.g., multiply by 1.2 for 20% increase)
            enemyBaseHealth = Math.floor(enemyBaseHealth * enemyUpgradeEffects.enemyBaseHealthBoost);
            console.log(`Enemy base health boosted to ${enemyBaseHealth}`);
        }
        
        this.enemyBase = new Base(this, this.WORLD_WIDTH - 100, this.GROUND_Y - 80, {
            isPlayerBase: false,
            color: 0xFF3333,
            health: enemyBaseHealth,
            maxHealth: enemyBaseHealth,
            width: 80, 
            height: 150
        });
        
        // Register base destruction callbacks
        this.playerBase.onDestroyed = () => this.onPlayerBaseDestroyed();
        this.enemyBase.onDestroyed = () => this.onEnemyBaseDestroyed();
    }
    
    /**
     * Set up all collision handlers
     */
    setupCollisions() {
        // Hero collides with platforms (created in ground/level setup)
        this.physics.add.collider(this.hero.sprite, this.platforms);
        
        // Hero collides with bases
        this.physics.add.collider(this.hero.sprite, [this.playerBase.sprite, this.enemyBase.sprite]);
        
        // Note: Arrow collisions with bases are set up individually in addArrowToScene method
        // Note: Platform collisions are handled directly in the Platform class itself
    }
    
    /**
     * Event handler for player base destruction
     */
    onPlayerBaseDestroyed() {
        console.log("Player base destroyed - Game Over!");
        this.gameActive = false;
        // You could add game over screen, restart option, etc. here
    }
    
    /**
     * Event handler for enemy base destruction
     */
    onEnemyBaseDestroyed() {
        console.log("Enemy base destroyed - Victory!");
        
        // Award XP for destroying the enemy base
        const xpReward = gameManager.economyConfig.xpRewards.baseDestroy;
        gameManager.addXP(xpReward, 'base destroy');
        
        // Get the enemy base position properly
        const basePosition = this.enemyBase.getPosition ? 
            this.enemyBase.getPosition() : 
            { x: this.enemyBase.sprite.x, y: this.enemyBase.sprite.y };
        
        // Show XP reward text
        this.showXPRewardEffect(basePosition.x, basePosition.y, `+${xpReward} XP`);
        this.updateXPDisplay();
        
        this.gameActive = false;
        
        console.log("Starting transition to UpgradeScene in 1.5 seconds...");
        
        // Use a more reliable approach for scene transition
        setTimeout(() => {
            console.log("Transitioning to UpgradeScene now");
            this.scene.start('UpgradeScene', { fromScene: 'GameScene' });
        }, 1500);
    }

    /**
     * Update all troops in the scene
     * @param {number} delta - Time delta since last update
     */
    updateTroops(delta) {
        // Skip if no target bases
        if (!this.playerBase || !this.enemyBase) return;
        
        // Update each troop
        for (let i = this.troops.length - 1; i >= 0; i--) {
            const troop = this.troops[i];
            
            // Skip inactive troops
            if (!troop.sprite || !troop.sprite.active) {
                this.troops.splice(i, 1);
                continue;
            }
            
            // Determine target base based on troop allegiance
            const targetBase = troop.isEnemy ? this.playerBase : this.enemyBase;
            
            // Update troop movement and behavior
            troop.move(delta, this.troops, targetBase, this.hero);
        }
    }

    /**
     * Spawn a new ally troop from the player base
     * @param {string} category - Category of troop to spawn
     * @param {Object} customConfig - Optional custom configuration
     */
    spawnAllyTroop(category = "Light", customConfig = {}) {
        if (!this.playerBase || !this.enemyBase) return;
        
        // Merge customConfig with any needed additional properties
        const config = { ...customConfig };
        
        // Create a troop at the player base position targeting the enemy base
        const troop = new Troop(
            this,
            this.playerBase.sprite.x,
            this.playerBase.sprite.y, 
            category,
            this.enemyBase.sprite.x,
            false, // Not an enemy
            config
        );
        
        // Add to troops array
        this.troops.push(troop);
        
        // Set up arrow registration for ranged troops
        this.registerArrowsForTroop(troop);
        
        return troop;
    }
    
    /**
     * Spawn a new enemy troop from the enemy base
     * @param {string} category - Category of troop to spawn
     * @param {Object} customConfig - Optional custom configuration
     */
    spawnEnemyTroop(category = "Light", customConfig = {}) {
        if (!this.playerBase || !this.enemyBase) return;
        
        // Create a troop at the enemy base position targeting the player base
        const troop = new Troop(
            this,
            this.enemyBase.sprite.x,
            this.enemyBase.sprite.y, 
            category,
            this.playerBase.sprite.x,
            true, // Is an enemy
            customConfig
        );
        
        // Add to troops array
        this.troops.push(troop);
        
        // Add collision with platforms
        this.physics.add.collider(troop.sprite, this.platforms);
        
        // Register existing arrows for collision with this new troop
        this.registerArrowsForTroop(troop);
        
        console.log(`Spawned enemy ${category} troop heading to player base`);
    }
    
    /**
     * Register all existing arrows for collision with a newly spawned troop
     * @param {Object} troop - The troop to register collisions for
     */
    registerArrowsForTroop(troop) {
        // Skip if troop is not an enemy or no arrows exist
        if (!troop.isEnemy || !this.arrows || this.arrows.length === 0) return;
        
        // Set up collision for each active arrow
        for (const arrow of this.arrows) {
            if (arrow && arrow.active) {
                this.physics.add.overlap(arrow, troop.sprite, 
                    (arrowSprite, troopSprite) => {
                        const arrowObj = arrowSprite.arrowInstance;
                        
                        // Call the arrow's hitEnemy method if it exists
                        if (arrowObj && typeof arrowObj.hitEnemy === 'function') {
                            arrowObj.hitEnemy(arrowSprite, troopSprite);
                        }
                    },
                    null, this);
            }
        }
    }
    
    /**
     * Legacy method - redirects to spawnAllyTroop
     * @param {string} category - Category of troop to spawn
     * @param {Object} customConfig - Optional custom configuration
     */
    spawnTroop(category = "Light", customConfig = {}) {
        this.spawnAllyTroop(category, customConfig);
    }

    /**
     * Setup the camera
     */
    setupCamera() {
        // Configure camera to follow hero
        const camera = this.cameras.main;
        camera.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);
        camera.startFollow(this.hero.sprite, true, 0.1, 0.1);
        
        // Ensure UI stays fixed to camera
        this.events.on('update', this.updateUI, this);
    }
    
    /**
     * Update UI elements to stay fixed to the camera
     */
    updateUI() {
        if (this.uiContainer) {
            // Position the UI container at the camera's scroll position
            this.uiContainer.setPosition(this.cameras.main.scrollX, this.cameras.main.scrollY);
        }
    }

    /**
     * Create the ground for the game world
     */
    createGround() {
        this.platforms = this.physics.add.staticGroup();
        
        // Create a gradient texture for the ground
        const groundTexture = this.add.graphics();
        groundTexture.fillGradientStyle(
            0x8B4513, // Base brown color
            0x8B4513, // Base brown color
            0x654321, // Darker brown for gradient
            0x654321, // Darker brown for gradient
            1
        );
        
        // Draw the main ground rectangle
        groundTexture.fillRect(0, 0, this.WORLD_WIDTH, this.GROUND_HEIGHT);
        
        // Add subtle texture with small random rectangles
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * this.WORLD_WIDTH;
            const y = Math.random() * this.GROUND_HEIGHT;
            const width = 2 + Math.random() * 4;
            const height = 2 + Math.random() * 4;
            
            // Randomly choose between slightly lighter or darker brown
            const color = Math.random() > 0.5 ? 0x9B5523 : 0x7B3513;
            groundTexture.fillStyle(color, 0.3);
            groundTexture.fillRect(x, y, width, height);
        }
        
        // Create the ground sprite with the texture
        const ground = this.add.rectangle(
            this.WORLD_WIDTH / 2, this.GROUND_Y, 
            this.WORLD_WIDTH, this.GROUND_HEIGHT, 
            0x8B4513
        );
        ground.setOrigin(0.5, 0.5);
        ground.setStrokeStyle(2, 0x4A2F1C); // Darker brown border
        ground.setDepth(1); // Ensure ground is above background elements
        
        // Add the ground to physics group
        this.platforms.add(ground);
    }

    /**
     * Set up all input controls for the game
     */
    setupInputs() {
        // Set up mouse/touch input for aiming and shooting
        this.setupMouseControls();
        
        // Set up keyboard input for movement
        const keys = this.input.keyboard.addKeys({
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE
        });
        
        // Pass keys to the update method
        this.keys = keys;
        
        // Set up keyboard shortcuts for upgrades
        this.setupUpgradeShortcuts();
        
        // Set up troop control shortcuts
        this.setupTroopControls();
        
        // Setup enemy test spawning
        this.setupTestingControls();
    }
    
    /**
     * Set up mouse controls for shooting
     */
    setupMouseControls() {
        this.input.on('pointerdown', () => {
            // Mouse button pressed - charging arrow
            if (this.hero) {
                this.hero.startCharging();
            }
        });
        
        this.input.on('pointerup', () => {
            // Mouse button released - firing arrow
            if (this.hero && this.gameActive) {
                // Get world position of mouse by adding camera scroll
                const worldX = this.input.activePointer.x + this.cameras.main.scrollX;
                const worldY = this.input.activePointer.y + this.cameras.main.scrollY;
                
                this.hero.releaseArrow(worldX, worldY);
            }
        });
    }
    
    /**
     * Set up keyboard shortcuts for upgrades
     */
    setupUpgradeShortcuts() {
        // Key bindings for base upgrades - show description on down, purchase on up
        this.input.keyboard.on('keydown-Z', () => {
            if (this.upgradeDescriptionBox) return;
            this.showUpgradeDescription('longbowTraining');
        });
        this.input.keyboard.on('keyup-Z', () => {
            if (this.upgradeDescriptionBox) {
                this.upgradeDescriptionBox.destroy();
                this.upgradeDescriptionBox = null;
                this.purchaseBaseUpgrade('longbowTraining');
            }
        });
        
        this.input.keyboard.on('keydown-X', () => {
            if (this.upgradeDescriptionBox) return;
            this.showUpgradeDescription('reinforcedWalls');
        });
        this.input.keyboard.on('keyup-X', () => {
            if (this.upgradeDescriptionBox) {
                this.upgradeDescriptionBox.destroy();
                this.upgradeDescriptionBox = null;
                this.purchaseBaseUpgrade('reinforcedWalls');
            }
        });
        
        this.input.keyboard.on('keydown-C', () => {
            if (this.upgradeDescriptionBox) return;
            this.showUpgradeDescription('improvedArrows');
        });
        this.input.keyboard.on('keyup-C', () => {
            if (this.upgradeDescriptionBox) {
                this.upgradeDescriptionBox.destroy();
                this.upgradeDescriptionBox = null;
                this.purchaseBaseUpgrade('improvedArrows');
            }
        });
        
        // Add debug info about controls to console
        console.log("Base Upgrades: Z (Longbow Training), X (Reinforced Walls), C (Improved Arrows)");
    }
    
    /**
     * Set up troop control shortcuts
     */
    setupTroopControls() {
        // Set up keyboard shortcuts for spawning troops
        this.input.keyboard.on('keydown-ONE', () => {
            this.spawnAllyTroopWithGold('Light');
        });
        
        this.input.keyboard.on('keydown-TWO', () => {
            this.spawnAllyTroopWithGold('Ranged');
        });
        
        this.input.keyboard.on('keydown-THREE', () => {
            this.spawnAllyTroopWithGold('Heavy');
        });
        
        this.input.keyboard.on('keydown-FOUR', () => {
            // Only check if the feature is unlocked
            if (gameManager.isFeatureUnlocked('longbowTraining')) {
                this.spawnAllyTroopWithGold('Ranged', 'Longbowman');
            } else {
                this.showUpgradeMessage('Longbowmen not unlocked!', '#FF0000');
            }
        });
        
        // Add debug info about troop controls
        console.log("Troop Controls: 1 (Light), 2 (Ranged), 3 (Heavy), 4 (Longbowman if unlocked)");
    }
    
    /**
     * Create a health bar for the hero
     */
    createHeroHealthBar() {
        // Create container for health bar
        this.healthBarContainer = this.add.container(20, this.cameras.main.height - 20);
        this.healthBarContainer.setScrollFactor(0); // Fix to camera
        this.healthBarContainer.setDepth(100); // Ensure it's above everything
        
        // Background bar
        this.healthBarBg = this.add.rectangle(0, 0, 204, 24, 0x000000);
        this.healthBarBg.setOrigin(0, 1);
        this.healthBarBg.setStrokeStyle(2, 0xffffff);
        
        // Health fill
        this.healthBarFill = this.add.rectangle(2, -2, 200, 20, 0x00ff00);
        this.healthBarFill.setOrigin(0, 1);
        
        // Health text
        this.healthText = this.add.text(102, -22, 'Health', {
            fontSize: '18px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.healthText.setOrigin(0.5, 0);
        
        // Add to container
        this.healthBarContainer.add([this.healthBarBg, this.healthBarFill, this.healthText]);
        
        // Initial update
        this.updateHeroHealthBar();
    }
    
    /**
     * Update health bar based on hero's current health
     */
    updateHeroHealthBar() {
        if (!this.hero || !this.healthBarFill) return;
        
        // Calculate percentage of health
        const healthPercent = this.hero.health / this.hero.maxHealth;
        
        // Update fill width
        const maxWidth = 200;
        const newWidth = Math.max(0, Math.floor(maxWidth * healthPercent));
        this.healthBarFill.width = newWidth;
        
        // Update color based on health
        let color;
        if (healthPercent > 0.6) {
            color = 0x00ff00; // Green
        } else if (healthPercent > 0.3) {
            color = 0xffff00; // Yellow
        } else {
            color = 0xff0000; // Red
        }
        this.healthBarFill.fillColor = color;
        
        // Update text
        this.healthText.setText(`Health: ${this.hero.health}`);
    }

    /**
     * Sets up the economy system including passive income
     */
    setupEconomySystem() {
        try {
            // Schedule passive income generation
            this.time.addEvent({
                delay: gameManager.economyConfig.passiveIncome.interval,
                callback: this.generatePassiveIncome,
                callbackScope: this,
                loop: true
            });
        } catch (error) {
            console.warn("Error in setupEconomySystem:", error);
        }
    }
    
    /**
     * Generate passive income on timer
     */
    generatePassiveIncome() {
        if (!this.gameActive) return;
        
        const baseAmount = gameManager.economyConfig.passiveIncome.baseAmount;
        gameManager.addGold(baseAmount, 'passive');
        this.updateGoldDisplay();
        this.updateXPDisplay();
        console.log(`Passive income: +${baseAmount} gold`);
    }
    
    /**
     * Update the gold display text
     */
    updateGoldDisplay() {
        try {
            if (this.goldText && typeof this.goldText.setText === 'function') {
                this.goldText.setText(`Gold: ${gameManager.gold}`);
            }
        } catch (error) {
            console.warn("Error updating gold display:", error);
        }
    }
    
    /**
     * Update XP display to reflect current XP amount
     */
    updateXPDisplay() {
        try {
            if (this.xpText && typeof this.xpText.setText === 'function') {
                this.xpText.setText(`XP: ${gameManager.xp}`);
            }
        } catch (error) {
            console.warn("Error updating XP display:", error);
        }
    }
    
    /**
     * Spawn ally troop if player has enough gold
     * @param {string} category - Troop category (Light, Medium, Heavy)
     * @param {string} type - Optional specific troop type within the category
     */
    spawnAllyTroopWithGold(category, type = null) {
        // Handle special case for Longbowman
        if (type === 'Longbowman') {
            // Check if longbowmen are unlocked (as a feature)
            if (!gameManager.isFeatureUnlocked('longbowTraining')) {
                this.showUpgradeMessage('Unlock longbowmen training first!', '#FF0000');
                return;
            }
            
            // Use the custom cost for longbowmen
            const cost = 75; // Could also be retrieved from troop config
            
            if (gameManager.spendGold(cost, `spawn Longbowman`)) {
                // Spawn with specific type
                this.spawnAllyTroop(category, { type: 'Longbowman' });
                
                // Show visual feedback
                this.showGoldSpendEffect(this.playerBase.sprite.x, this.playerBase.sprite.y - 30, `-${cost}g`);
                this.updateGoldDisplay();
            } else {
                this.showNotEnoughGoldMessage();
            }
            return;
        }
        
        // Standard troop spawning for other types
        const cost = gameManager.getUnitCost(category);
        
        if (gameManager.spendGold(cost, `spawn ${category} troop`)) {
            // If gold was successfully spent, spawn the troop
            this.spawnAllyTroop(category);
            
            // Show visual feedback
            this.showGoldSpendEffect(this.playerBase.sprite.x, this.playerBase.sprite.y - 30, `-${cost}g`);
            this.updateGoldDisplay();
        } else {
            this.showNotEnoughGoldMessage();
        }
    }
    
    /**
     * Display a message when player doesn't have enough gold
     */
    showNotEnoughGoldMessage() {
        const x = this.hero.sprite.x;
        const y = this.hero.sprite.y - 40;
        
        const text = this.add.text(x, y, 'Not enough gold!', {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#FF0000',
            stroke: '#000000',
            strokeThickness: 2
        });
        text.setOrigin(0.5);
        
        this.tweens.add({
            targets: text,
            y: y - 30,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
    
    /**
     * Show gold spending effect
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Text to display
     */
    showGoldSpendEffect(x, y, text) {
        const goldText = this.add.text(x, y, text, {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2
        });
        goldText.setOrigin(0.5);
        
        this.tweens.add({
            targets: goldText,
            y: y - 30,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => goldText.destroy()
        });
    }
    
    /**
     * Award gold for killing enemy troops
     * @param {Troop} troop - The troop that was killed
     */
    awardGoldForKill(troop) {
        if (!troop || troop.isEnemy === false) return;
        
        const reward = gameManager.calculateKillReward(troop.category);
        gameManager.addGold(reward, 'enemy kill');
        
        // Award XP based on troop category
        const xpReward = gameManager.economyConfig.xpRewards.troopKill[troop.category];
        gameManager.addXP(xpReward, 'enemy kill');
        
        // Show floating text for reward
        this.showGoldRewardEffect(troop.sprite.x, troop.sprite.y, `+${reward}`);
        
        // Show floating text for XP
        this.showXPRewardEffect(troop.sprite.x, troop.sprite.y - 20, `+${xpReward} XP`);
    }
    
    /**
     * Show gold reward effect
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Text to display
     */
    showGoldRewardEffect(x, y, text) {
        const goldText = this.add.text(x, y, text, {
            fontFamily: 'Arial',
            fontSize: 14,
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2
        });
        goldText.setOrigin(0.5);
        
        this.tweens.add({
            targets: goldText,
            y: y - 40,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => goldText.destroy()
        });
    }
    
    /**
     * Show XP reward effect
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Text to display
     */
    showXPRewardEffect(x, y, text) {
        try {
            const xpText = this.add.text(x, y, text, {
                fontFamily: 'Arial',
                fontSize: 14,
                color: '#32CD32', // Green color for XP
                stroke: '#000000',
                strokeThickness: 2
            });
            xpText.setOrigin(0.5);
            
            // Create a shorter, simpler tween that won't interfere with scene transitions
            this.tweens.add({
                targets: xpText,
                y: y - 30,
                alpha: 0,
                duration: 800,
                ease: 'Power1',
                onComplete: () => {
                    if (xpText && xpText.destroy) {
                        xpText.destroy();
                    }
                }
            });
        } catch (error) {
            console.warn("Error showing XP reward effect:", error);
        }
    }
    
    /**
     * Purchase base upgrade
     * @param {string} upgradeId - ID of the upgrade to purchase
     */
    purchaseBaseUpgrade(upgradeId) {
        if (gameManager.purchaseUpgrade(upgradeId)) {
            // Show visual feedback
            this.showGoldSpendEffect(
                this.playerBase.x, 
                this.playerBase.y - 50, 
                `-${gameManager.economyConfig.baseUpgrades[upgradeId].cost}g`
            );
            
            // Apply upgrade effect
            this.applyUpgradeEffect(upgradeId);
        } else {
            // Show "Not enough gold" or "Already purchased" message
            if (gameManager.purchasedUpgrades[upgradeId]) {
                this.showUpgradeMessage('Already purchased!', '#FFAA00');
            } else {
                this.showNotEnoughGoldMessage();
            }
        }
    }
    
    /**
     * Show upgrade status message
     * @param {string} message - Message to display
     * @param {string} color - Color of the message
     */
    showUpgradeMessage(message, color = '#FFFFFF') {
        const x = this.hero.sprite.x;
        const y = this.hero.sprite.y - 40;
        
        const text = this.add.text(x, y, message, {
            fontFamily: 'Arial',
            fontSize: 14,
            color: color,
            stroke: '#000000',
            strokeThickness: 2
        });
        text.setOrigin(0.5);
        
        this.tweens.add({
            targets: text,
            y: y - 30,
            alpha: 0,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
    
    /**
     * Apply upgrade effect based on upgrade ID
     * @param {string} upgradeId - ID of the upgrade
     */
    applyUpgradeEffect(upgradeId) {
        const upgrade = gameManager.economyConfig.baseUpgrades[upgradeId];
        if (!upgrade) return;
        
        // Apply specific upgrade effects
        switch (upgradeId) {
            case 'longbowTraining':
                // Unlock longbowmen units for summoning
                this.showUpgradeMessage('Longbowmen unlocked!', '#00FF00');
                // Update the troop button UI
                this.updateSpecialTroopButtons();
                break;
                
            case 'reinforcedWalls':
                // Increase player base health by 25%
                if (this.playerBase && this.playerBase.health) {
                    const healthBonus = Math.floor(this.playerBase.maxHealth * 0.25);
                    this.playerBase.maxHealth += healthBonus;
                    this.playerBase.health += healthBonus;
                    this.playerBase.updateHealthBar();
                    this.showUpgradeMessage(`Base health +${healthBonus}!`, '#00FF00');
                }
                break;
                
            case 'improvedArrows':
                // Placeholder for improving hero arrow damage
                this.showUpgradeMessage('Arrow damage +20%!', '#00FF00');
                // Future implementation: this.hero.arrowDamageMultiplier = 1.2;
                break;
                
            // Platform ability upgrades
            case 'extendedPlatforms':
                if (this.hero) {
                    // Increase platform duration by 50%
                    const newDuration = Math.floor(gameManager.economyConfig.platformAbility.duration * 1.5);
                    this.hero.platformDuration = newDuration;
                    gameManager.economyConfig.platformAbility.hasUpgrades = true;
                    this.showUpgradeMessage('Platforms last 50% longer!', '#00FF00');
                }
                break;
                
            case 'quickSummoning':
                if (this.hero) {
                    // Reduce cooldown by 25%
                    const newCooldown = Math.floor(gameManager.economyConfig.platformAbility.cooldown * 0.75);
                    this.hero.platformCooldown = newCooldown;
                    gameManager.economyConfig.platformAbility.hasUpgrades = true;
                    this.showUpgradeMessage('Platform cooldown reduced by 25%!', '#00FF00');
                }
                break;
                
            case 'widePlatforms':
                if (this.hero) {
                    // Increase platform width by 40%
                    const newWidth = Math.floor(gameManager.economyConfig.platformAbility.width * 1.4);
                    this.hero.platformWidth = newWidth;
                    gameManager.economyConfig.platformAbility.hasUpgrades = true;
                    this.showUpgradeMessage('Platforms are 40% wider!', '#00FF00');
                }
                break;
                
            default:
                console.log(`No effect implementation for upgrade: ${upgradeId}`);
                break;
        }
    }

    /**
     * Update UI elements and features based on current game state
     * Called when the scene starts or after round advancement
     */
    updateBasedOnGameState() {
        try {
            console.log("Updating game state for round:", gameManager.currentRound);
            
            // Always restart with fresh UI elements to avoid reusing problematic objects
            this._cleanupUIElements();
            
            // Create a fresh UI container
            this.uiContainer = this.add.container(0, 0);
            this.uiContainer.setDepth(1000); // Ensure UI is on top
            
            // Create new round text
            const roundText = this.add.text(
                this.cameras.main.width - 120, 
                10, 
                `Round: ${gameManager.currentRound}`, 
                { 
                    fontFamily: 'Arial', 
                    fontSize: 16, 
                    color: '#FFFFFF'
                }
            );
            this.roundText = roundText;
            this.uiContainer.add(roundText);
            
            // Setup the gold and XP display
            this._setupEconomyDisplay();
            
            // Recreate troop buttons
            this._setupTroopButtons();
            
            // If it's the first round, provide some basic instructions
            if (gameManager.currentRound === 1) {
                const instructions = this.add.text(
                    this.cameras.main.width / 2,
                    this.cameras.main.height - 50,
                    'Defeat the enemy base to advance to the next round!',
                    {
                        fontFamily: 'Arial',
                        fontSize: 18,
                        color: '#FFFFFF'
                    }
                ).setOrigin(0.5);
                
                this.uiContainer.add(instructions);
                
                // Fade out after 5 seconds
                this.tweens.add({
                    targets: instructions,
                    alpha: 0,
                    delay: 5000,
                    duration: 1000,
                    onComplete: () => {
                        if (instructions && instructions.destroy) {
                            instructions.destroy();
                        }
                    }
                });
            }
            
            // Reinitialize game state
            this.gameActive = true;
            
            console.log("Game state update completed successfully!");
        } catch (error) {
            console.warn("Error in updateBasedOnGameState:", error);
            // Make sure the game is still active even if there's an error
            this.gameActive = true;
        }
    }
    
    /**
     * Clean up existing UI elements to avoid conflicts
     * @private
     */
    _cleanupUIElements() {
        // Safe cleanup of UI container
        if (this.uiContainer) {
            try {
                this.uiContainer.destroy();
            } catch (e) {
                console.warn("Error destroying UI container:", e);
            }
            this.uiContainer = null;
        }
        
        // Clean up round text
        if (this.roundText) {
            try {
                this.roundText.destroy();
            } catch (e) {
                console.warn("Error destroying round text:", e);
            }
            this.roundText = null;
        }
        
        // Clean up troop buttons
        const troopButtons = [
            'lightTroopButton', 
            'heavyTroopButton', 
            'rangedTroopButton', 
            'longbowmanButton'
        ];
        
        troopButtons.forEach(buttonName => {
            if (this[buttonName]) {
                try {
                    this[buttonName].destroy();
                } catch (e) {
                    console.warn(`Error destroying ${buttonName}:`, e);
                }
                this[buttonName] = null;
            }
        });
        
        // Clean up economy display
        if (this.goldText) {
            try {
                this.goldText.destroy();
            } catch (e) {
                console.warn("Error destroying gold text:", e);
            }
            this.goldText = null;
        }
        
        if (this.xpText) {
            try {
                this.xpText.destroy();
            } catch (e) {
                console.warn("Error destroying XP text:", e);
            }
            this.xpText = null;
        }
    }
    
    /**
     * Set up simplified economy display
     * @private
     */
    _setupEconomyDisplay() {
        try {
            // Create gold display text with minimal styling
            this.goldText = this.add.text(10, 10, `Gold: ${gameManager.gold}`, {
                fontFamily: 'Arial',
                fontSize: 16,
                color: '#FFFFFF'
            });
            this.uiContainer.add(this.goldText);
            
            // Create XP display text with minimal styling
            this.xpText = this.add.text(10, 35, `XP: ${gameManager.xp}`, {
                fontFamily: 'Arial',
                fontSize: 16,
                color: '#FFFFFF'
            });
            this.uiContainer.add(this.xpText);
        } catch (error) {
            console.warn("Error setting up economy display:", error);
        }
    }
    
    /**
     * Set up troop buttons
     * @private
     */
    _setupTroopButtons() {
        try {
            // UI positions
            const controlsX = 120;
            const controlsY = 50;
            const spacing = 80;
            
            // Create light troop button
            this.lightTroopButton = this.add.container(controlsX, controlsY);
            const lightBg = this.add.circle(0, 0, 30, 0x00AA00)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.spawnAllyTroopWithGold('Light'));
            
            const lightText = this.add.text(0, 0, 'L', { 
                fontFamily: 'Arial',
                fontSize: 24,
                color: '#FFFFFF' 
            }).setOrigin(0.5);
            
            const lightCost = this.add.text(0, 30, `${gameManager.getUnitCost('Light')}g`, { 
                fontFamily: 'Arial',
                fontSize: 14,
                color: '#FFFFFF' 
            }).setOrigin(0.5);
            
            this.lightTroopButton.add([lightBg, lightText, lightCost]);
            this.uiContainer.add(this.lightTroopButton);
            
            // Create heavy troop button
            this.heavyTroopButton = this.add.container(controlsX + spacing, controlsY);
            const heavyBg = this.add.circle(0, 0, 30, 0x008800)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.spawnAllyTroopWithGold('Heavy'));
            
            const heavyText = this.add.text(0, 0, 'H', { 
                fontFamily: 'Arial',
                fontSize: 24,
                color: '#FFFFFF' 
            }).setOrigin(0.5);
            
            const heavyCost = this.add.text(0, 30, `${gameManager.getUnitCost('Heavy')}g`, { 
                fontFamily: 'Arial',
                fontSize: 14,
                color: '#FFFFFF' 
            }).setOrigin(0.5);
            
            this.heavyTroopButton.add([heavyBg, heavyText, heavyCost]);
            this.uiContainer.add(this.heavyTroopButton);
            
            // Create ranged troop button
            this.rangedTroopButton = this.add.container(controlsX + spacing * 2, controlsY);
            const rangedBg = this.add.circle(0, 0, 30, 0x00CC00)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.spawnAllyTroopWithGold('Ranged'));
            
            const rangedText = this.add.text(0, 0, 'R', { 
                fontFamily: 'Arial',
                fontSize: 24,
                color: '#FFFFFF' 
            }).setOrigin(0.5);
            
            const rangedCost = this.add.text(0, 30, `${gameManager.getUnitCost('Ranged')}g`, { 
                fontFamily: 'Arial',
                fontSize: 14,
                color: '#FFFFFF' 
            }).setOrigin(0.5);
            
            this.rangedTroopButton.add([rangedBg, rangedText, rangedCost]);
            this.uiContainer.add(this.rangedTroopButton);
            
            // Create longbowman button 
            this.longbowmanButton = this.add.container(controlsX + spacing * 3, controlsY);
            const longbowBg = this.add.circle(0, 0, 30, 0x225588)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.spawnAllyTroopWithGold('Ranged', 'Longbowman'));
            
            const longbowText = this.add.text(0, 0, 'LB', { 
                fontFamily: 'Arial',
                fontSize: 20,
                color: '#FFFFFF' 
            }).setOrigin(0.5);
            
            const longbowCost = this.add.text(0, 30, '75g', { 
                fontFamily: 'Arial',
                fontSize: 14,
                color: '#FFFFFF' 
            }).setOrigin(0.5);
            
            this.longbowmanButton.add([longbowBg, longbowText, longbowCost]);
            
            // Initially hide, will be updated in updateSpecialTroopButtons
            this.longbowmanButton.setVisible(false);
            this.uiContainer.add(this.longbowmanButton);
            
            // Update visibility based on unlocks
            this.updateSpecialTroopButtons();
        } catch (error) {
            console.warn("Error setting up troop buttons:", error);
        }
    }

    /**
     * Set up testing-only controls
     */
    setupTestingControls() {
        // Add enemy troop spawning for testing - using number keys
        this.input.keyboard.on('keydown-SEVEN', () => {
            if (this.gameActive) {
                this.spawnEnemyTroop("Light");
                console.log("Spawned enemy Light troop (testing)");
            }
        });
        
        this.input.keyboard.on('keydown-EIGHT', () => {
            if (this.gameActive) {
                this.spawnEnemyTroop("Ranged");
                console.log("Spawned enemy Ranged troop (testing)");
            }
        });
        
        this.input.keyboard.on('keydown-NINE', () => {
            if (this.gameActive) {
                this.spawnEnemyTroop("Heavy");
                console.log("Spawned enemy Heavy troop (testing)");
            }
        });
        
        // Add debug info about controls
        console.log("Testing Controls: Enemy Troops: 7 (Light), 8 (Ranged), 9 (Heavy)");
    }

    /**
     * Show upgrade description
     * @param {string} upgradeId - ID of the upgrade to describe
     */
    showUpgradeDescription(upgradeId) {
        try {
            // Get upgrade info
            const upgrade = gameManager.economyConfig.baseUpgrades[upgradeId];
            if (!upgrade) return;
            
            // Create description box near the middle of the screen
            const descriptionBox = this.add.container(
                this.cameras.main.width / 2,
                this.cameras.main.height / 2 - 50
            );
            
            // Background
            const bg = this.add.rectangle(0, 0, 400, 150, 0x000000, 0.8)
                .setOrigin(0.5);
            bg.setStrokeStyle(2, 0xFFFFFF);
            
            // Upgrade title
            const title = this.add.text(0, -50, upgradeId, {
                fontFamily: 'Arial',
                fontSize: 24,
                color: '#FFFFFF'
            }).setOrigin(0.5);
            
            // Description
            const description = this.add.text(0, -10, upgrade.description, {
                fontFamily: 'Arial',
                fontSize: 18,
                color: '#FFFFFF'
            }).setOrigin(0.5);
            
            // Cost
            const cost = this.add.text(0, 30, `Cost: ${upgrade.cost} gold`, {
                fontFamily: 'Arial',
                fontSize: 18,
                color: gameManager.gold >= upgrade.cost ? '#00FF00' : '#FF0000'
            }).setOrigin(0.5);
            
            // Add close hint
            const closeHint = this.add.text(0, 60, 'Press ESC to close', {
                fontFamily: 'Arial',
                fontSize: 14,
                color: '#CCCCCC'
            }).setOrigin(0.5);
            
            descriptionBox.add([bg, title, description, cost, closeHint]);
            
            // Make sure UI container exists
            if (!this.uiContainer) {
                this.uiContainer = this.add.container(0, 0);
                this.uiContainer.setDepth(1000);
            }
            
            // Add to UI container to stick with camera
            if (this.uiContainer && descriptionBox) {
                this.uiContainer.add(descriptionBox);
            }
            
            // Store reference
            this.upgradeDescriptionBox = descriptionBox;
            
            // Set up key to close it
            const escKey = this.input.keyboard.addKey('ESC');
            escKey.once('down', () => {
                if (this.upgradeDescriptionBox) {
                    this.upgradeDescriptionBox.destroy();
                    this.upgradeDescriptionBox = null;
                }
            });
            
            // Auto-close after 5 seconds
            this.time.delayedCall(5000, () => {
                if (this.upgradeDescriptionBox) {
                    this.upgradeDescriptionBox.destroy();
                    this.upgradeDescriptionBox = null;
                }
            });
        } catch (error) {
            console.warn("Error in showUpgradeDescription:", error);
        }
    }

    /**
     * Update the visibility of special troop buttons based on unlocked features and upgrades
     */
    updateSpecialTroopButtons() {
        // Skip if longbowman button doesn't exist yet
        if (!this.longbowmanButton) return;
        
        // Longbowman button visibility - show it if the feature is unlocked
        // We don't need to check purchasedUpgrades here because the button should be 
        // visible once the feature is unlocked via XP, so you can purchase it with gold
        if (gameManager.isFeatureUnlocked('longbowTraining')) {
            this.longbowmanButton.setVisible(true);
        } else {
            this.longbowmanButton.setVisible(false);
        }
    }
}
