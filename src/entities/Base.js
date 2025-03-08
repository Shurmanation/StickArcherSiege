/**
 * Base.js - Represents a player or enemy base in the game
 * 
 * Handles:
 * - Base visual representation
 * - Health tracking
 * - Collision with arrows
 * - Win/lose conditions
 */

export default class Base {
    /**
     * Create a new base
     * @param {Phaser.Scene} scene - The scene this base belongs to
     * @param {number} x - X coordinate of the base
     * @param {number} y - Y coordinate of the base
     * @param {Object} options - Configuration options
     */
    constructor(scene, x, y, options = {}) {
        this.scene = scene;
        
        // Default options
        const defaults = {
            width: 80,
            height: 120,
            color: 0x6666FF,       // Blue by default
            health: 1000,
            maxHealth: 1000,
            isPlayerBase: false,   // Is this the player's base?
            name: "Base"           // Display name
        };
        
        // Merge with provided options
        this.options = { ...defaults, ...options };
        
        // Create visual representation (rectangle for now)
        this.sprite = scene.add.rectangle(
            x, y, 
            this.options.width, 
            this.options.height, 
            this.options.color
        );
        
        // Add border
        this.sprite.setStrokeStyle(3, 0xFFFFFF);
        
        // Enable physics (static body that doesn't move)
        scene.physics.add.existing(this.sprite, true); // true = static body
        
        // Set up health properties
        this.health = this.options.health;
        this.maxHealth = this.options.maxHealth;
        
        // Create health bar
        this.createHealthBar();
        
        // Store base data on the sprite for collision callbacks
        this.sprite.baseInstance = this;
    }
    
    /**
     * Create a health bar above the base
     */
    createHealthBar() {
        // Position health bar above the base
        const barX = this.sprite.x;
        const barY = this.sprite.y - (this.options.height / 2) - 15;
        
        // Create background bar
        this.healthBarBg = this.scene.add.rectangle(
            barX, barY,
            this.options.width + 10, 12,
            0x000000
        );
        this.healthBarBg.setStrokeStyle(1, 0xFFFFFF);
        
        // Create health bar fill
        this.healthBarFill = this.scene.add.rectangle(
            barX - (this.options.width + 10) / 2 + 1, barY,
            this.options.width + 8, 10,
            0x00FF00
        );
        this.healthBarFill.setOrigin(0, 0.5);
        
        // Name text removed for cleaner UI
        
        // Create health text
        this.healthText = this.scene.add.text(
            barX, barY,
            `${this.health}/${this.maxHealth}`,
            { 
                font: '12px Arial', 
                fill: '#FFFFFF' 
            }
        ).setOrigin(0.5);
        
        // Update the health bar
        this.updateHealthBar();
    }
    
    /**
     * Update the health bar to reflect current health
     */
    updateHealthBar() {
        const healthPercent = this.health / this.maxHealth;
        const barWidth = (this.options.width + 8) * healthPercent;
        
        // Update bar width
        this.healthBarFill.width = Math.max(0, barWidth);
        
        // Update color based on health percentage
        if (healthPercent > 0.6) {
            this.healthBarFill.fillColor = 0x00FF00; // Green
        } else if (healthPercent > 0.3) {
            this.healthBarFill.fillColor = 0xFFFF00; // Yellow
        } else {
            this.healthBarFill.fillColor = 0xFF0000; // Red
        }
        
        // Update text
        this.healthText.setText(`${this.health}/${this.maxHealth}`);
    }
    
    /**
     * Handle damage to the base
     * @param {number} amount - Amount of damage to take
     * @param {object} source - Source of the damage (e.g., an arrow)
     */
    takeDamage(amount, source) {
        // Ensure amount is valid
        if (isNaN(amount) || amount <= 0) return;
        
        // Round damage to integer
        const damageAmount = Math.round(amount);
        
        // Reduce health
        this.health = Math.max(0, this.health - damageAmount);
        
        // Update health bar
        this.updateHealthBar();
        
        // Flash the base red to indicate damage
        this.sprite.setFillStyle(0xFF0000);
        this.scene.time.delayedCall(100, () => {
            if (this.sprite && this.sprite.active) {
                this.sprite.setFillStyle(this.options.color);
            }
        });
        
        // Show damage indicator (only for enemy base)
        if (!this.options.isPlayerBase && this.sprite && this.sprite.active) {
            if (this.scene && this.scene.showDamageIndicator) {
                this.scene.showDamageIndicator(this.sprite.x, this.sprite.y, damageAmount);
            }
        }
        
        // Check if base is destroyed
        if (this.health <= 0) {
            this.onDestroyed();
        }
    }
    
    /**
     * Handle base destruction
     */
    onDestroyed() {
        // Determine what message to show based on which base was destroyed
        const message = this.options.isPlayerBase ? 
            'Player base destroyed! Game Over!' : 
            'Enemy base destroyed! Victory!';
        
        // Create a large text notification
        const centerX = this.scene.cameras.main.width / 2;
        const centerY = this.scene.cameras.main.height / 2;
        
        const gameOverText = this.scene.add.text(
            centerX, centerY,
            message,
            { 
                font: '32px Arial', 
                fill: this.options.isPlayerBase ? '#FF0000' : '#00FF00',
                stroke: '#000000',
                strokeThickness: 4 
            }
        ).setOrigin(0.5);
        
        // Trigger appropriate event in the scene if it has a handler
        if (this.options.isPlayerBase && this.scene.onPlayerBaseDestroyed) {
            this.scene.onPlayerBaseDestroyed();
        } else if (!this.options.isPlayerBase && this.scene.onEnemyBaseDestroyed) {
            this.scene.onEnemyBaseDestroyed();
        }
    }
    
    /**
     * Collision handler for when an arrow hits the base
     * @param {Phaser.GameObjects.Rectangle} baseSprite - The base sprite
     * @param {Phaser.GameObjects.Rectangle} arrowSprite - The arrow sprite
     */
    static onArrowHit(baseSprite, arrowSprite) {
        // Get base instance from the sprite
        const base = baseSprite.baseInstance;
        
        // Get arrow instance if available
        const arrow = arrowSprite.arrowInstance;
        
        // If a base instance exists and is valid
        if (base) {
            // Get damage directly from the arrow sprite
            const damageAmount = arrowSprite.damage || 10; // Fallback to 10
            
            // Apply damage to the base
            base.takeDamage(damageAmount, arrowSprite);
            
            // If arrow instance is available, make it stick
            if (arrow && !arrow.hasHit) {
                arrow.hasHit = true;
                
                // Stop arrow movement
                arrowSprite.body.setVelocity(0, 0);
                arrowSprite.body.setAllowGravity(false);
                
                // Make arrow stick for a moment then fade away
                base.scene.time.delayedCall(2000, () => {
                    if (arrowSprite && arrowSprite.active) {
                        base.scene.tweens.add({
                            targets: arrowSprite,
                            alpha: 0,
                            duration: 500,
                            onComplete: () => {
                                if (arrow && typeof arrow.destroy === 'function') {
                                    arrow.destroy();
                                } else if (arrowSprite.active) {
                                    arrowSprite.destroy();
                                }
                            }
                        });
                    }
                });
            } else if (arrowSprite.active) {
                // If no arrow instance, just destroy the sprite
                arrowSprite.destroy();
            }
        }
    }
} 