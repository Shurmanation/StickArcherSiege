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
        
        // Set up collisions
        this.setupCollisions();
        
        // Set up input controls (keyboard, mouse, etc.)
        this.setupInputs();
        
        // Create hero health bar
        this.createHeroHealthBar();
        
        // Setup economy display and systems
        this.setupEconomySystem();
    }

    update(time, delta) {
        // Skip updates if game is over
        if (!this.gameActive) return;
        
        if (this.hero) {
            this.hero.update(this.keys);
        }
        
        // Update star positions for parallax effect
        this.updateStarParallax();
        
        // Update troop movements
        this.updateTroops(delta);
        
        // Clean up arrows that are out of bounds
        this.cleanupArrows();
        
        // Update gold display if it exists
        this.updateGoldDisplay();
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
        // Create player base on the left side
        this.playerBase = new Base(this, 150, 500, {
            color: 0x3333FF,        // Blue color for player
            isPlayerBase: true,
            name: "Player Base",
            width: 60,
            height: 100,
            health: 1000,
            maxHealth: 1000
        });
        
        // Create enemy base on the far right side
        this.enemyBase = new Base(this, this.worldBounds.width - 150, 500, {
            color: 0xFF3333,        // Red color for enemy
            isPlayerBase: false,
            name: "Enemy Base",
            width: 60,
            height: 100,
            health: 1000,
            maxHealth: 1000
        });
    }
    
    /**
     * Set up all collision handlers
     */
    setupCollisions() {
        // Hero collides with platforms
        this.physics.add.collider(this.hero.sprite, this.platforms);
        
        // Hero collides with bases
        this.physics.add.collider(this.hero.sprite, [this.playerBase.sprite, this.enemyBase.sprite]);
        
        // Note: Arrow collisions with bases are set up individually in addArrowToScene method
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
        this.gameActive = false;
        // You could add victory screen, next level option, etc. here
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
        
        // Create a troop at the player base position targeting the enemy base
        const troop = new Troop(
            this,
            this.playerBase.sprite.x,
            this.playerBase.sprite.y, 
            category,
            this.enemyBase.sprite.x,
            false, // Not an enemy
            customConfig
        );
        
        // Add to troops array
        this.troops.push(troop);
        
        // Add collision with platforms
        this.physics.add.collider(troop.sprite, this.platforms);
        
        console.log(`Spawned ally ${category} troop heading to enemy base`);
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
     * Configure camera to follow the hero with offset and deadzone
     */
    setupCamera() {
        // Set camera bounds to match world bounds
        this.cameras.main.setBounds(0, 0, this.WORLD_WIDTH, this.WORLD_HEIGHT);
        
        // Follow the hero with offset (showing more to the right)
        this.cameras.main.startFollow(
            this.hero.sprite,
            true,                   // Round pixels to avoid visual artifacts
            0.1,                    // Horizontal lerp (smoothness)
            0.1,                    // Vertical lerp (smoothness)
            150,                    // X offset (positive shows more to the right)
            0                       // Y offset
        );
        
        // Set a larger deadzone to reduce camera movement for small player movements
        this.cameras.main.setDeadzone(150, 100);
        
        // Set follow offset to show more of what's ahead
        this.cameras.main.setFollowOffset(-150, 0);
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
        // Set up movement controls (WASD)
        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE // Add space bar for platform summoning
        });
        
        // Setup mouse input for charging and shooting with camera position adjustment
        this.setupMouseControls();
        
        // Setup keyboard input for spawning troops
        this.setupTroopControls();
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
     * Set up keyboard controls for troop spawning
     */
    setupTroopControls() {
        // Keyboard controls for spawning troops
        this.input.keyboard.on('keydown-ONE', () => {
            this.spawnAllyTroopWithGold('Light');
        });
        
        this.input.keyboard.on('keydown-TWO', () => {
            this.spawnAllyTroopWithGold('Medium');
        });
        
        this.input.keyboard.on('keydown-THREE', () => {
            this.spawnAllyTroopWithGold('Heavy');
        });
        
        // Key bindings for base upgrades
        this.input.keyboard.on('keydown-Z', () => {
            this.purchaseBaseUpgrade('longbowTraining');
        });
        
        this.input.keyboard.on('keydown-X', () => {
            this.purchaseBaseUpgrade('reinforcedWalls');
        });
        
        this.input.keyboard.on('keydown-C', () => {
            this.purchaseBaseUpgrade('improvedArrows');
        });
        
        // Add debug info about controls
        console.log("Troop Controls:");
        console.log("Ally Troops: 1 (Light), 2 (Medium), 3 (Heavy)");
        console.log("Base Upgrades: Z (Longbow Training), X (Reinforced Walls), C (Improved Arrows)");
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
     * Sets up the economy system including gold display and passive income
     */
    setupEconomySystem() {
        // Create gold display in the top-left corner of the screen
        this.goldText = this.add.text(10, 10, `Gold: ${gameManager.gold}`, {
            fontFamily: 'Arial',
            fontSize: 18,
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
            shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 1, stroke: true, fill: true }
        });
        this.goldText.setScrollFactor(0); // Fix to camera so it stays on screen
        this.goldText.setDepth(100);      // Make sure it's visible above other elements
        
        // Set up passive income timer
        this.passiveIncomeTimer = this.time.addEvent({
            delay: gameManager.economyConfig.passiveIncome.interval,
            callback: this.generatePassiveIncome,
            callbackScope: this,
            loop: true
        });
        
        // Create upgrade button text at the bottom of the screen (visual reference for upgrade options)
        const upgradeInfo = this.add.text(10, this.cameras.main.height - 60, 
            'Upgrades: [Z] Longbow (400g)  [X] Reinforced Walls (300g)  [C] Improved Arrows (250g)', {
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 1
        });
        upgradeInfo.setScrollFactor(0);
        upgradeInfo.setDepth(100);
        
        // Create troop spawning info at the bottom of the screen
        const troopInfo = this.add.text(10, this.cameras.main.height - 30, 
            'Troops: [1] Light (20g)  [2] Medium (35g)  [3] Heavy (50g)', {
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 1
        });
        troopInfo.setScrollFactor(0);
        troopInfo.setDepth(100);
    }
    
    /**
     * Generate passive income on timer
     */
    generatePassiveIncome() {
        const baseAmount = gameManager.economyConfig.passiveIncome.baseAmount;
        gameManager.addGold(baseAmount, 'passive');
        this.updateGoldDisplay();
    }
    
    /**
     * Update the gold display text
     */
    updateGoldDisplay() {
        if (this.goldText) {
            this.goldText.setText(`Gold: ${gameManager.gold}`);
        }
    }
    
    /**
     * Spawn ally troop if player has enough gold
     * @param {string} category - Troop category (Light, Medium, Heavy)
     */
    spawnAllyTroopWithGold(category) {
        const cost = gameManager.getUnitCost(category);
        
        if (gameManager.spendGold(cost, `spawn ${category} troop`)) {
            // If gold was successfully spent, spawn the troop
            this.spawnAllyTroop(category);
            
            // Show visual feedback
            this.showGoldSpendEffect(this.playerBase.x + 20, this.playerBase.y - 30, `-${cost}g`);
        } else {
            // Show "Not enough gold" message near the player base
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
        
        // Show floating text for reward
        this.showGoldRewardEffect(troop.sprite.x, troop.sprite.y, `+${reward}`);
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
                // Placeholder for unlocking longbowmen units
                this.showUpgradeMessage('Longbowmen unlocked!', '#00FF00');
                // Future implementation: this.unlockedUnits.longbowmen = true;
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
                
            default:
                console.log(`No effect implementation for upgrade: ${upgradeId}`);
                break;
        }
    }
}
