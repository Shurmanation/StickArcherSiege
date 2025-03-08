/**
 * Hero.js
 * Player character class that handles movement, jumping, and shooting arrows
 */

// Import Arrow class
import Arrow from './Arrow.js';
// Import SummonedPlatform class
import SummonedPlatform from './SummonedPlatform.js';

export default class Hero {
    constructor(scene, x, y) {
        // Scene reference
        this.scene = scene;
        
        // Identify as hero
        this.isHero = true;
        
        // Store initial position for respawn
        this.initialX = x;
        this.initialY = y;
        
        // Health system
        this.maxHealth = 200;
        this.health = this.maxHealth;
        this.isAlive = true;
        
        // Create sprite and physics body
        this.sprite = scene.add.rectangle(x, y, 30, 50, 0x0000FF);
        this.sprite.setStrokeStyle(2, 0xFFFFFF);
        this.sprite.setDepth(16); // Set hero depth to be above projectiles
        scene.physics.add.existing(this.sprite);
        this.sprite.body.setBounce(0.1);
        this.sprite.body.setCollideWorldBounds(true);
        
        // Movement properties
        this.moveSpeed = 250;
        this.jumpPower = -400;
        this.maxJumpTime = 400; // ms
        this.isJumping = false;
        this.fastFallSpeed = 650;
        
        // Archery system
        this.shootCooldown = 300;
        this.lastShot = 0;
        this.arrowSpeed = 900;
        
        // Damage stats (will be passed to arrows)
        this.baseDamage = 15;           // Base damage for arrows
        this.damageMultiplier = 1.0;    // For future upgrades (e.g., +40% damage)
        
        // Power charging system
        this.isCharging = false;
        this.chargeStartTime = 0;
        this.powerLevel = 0;
        this.oscillationSpeed = 1500; // ms for a full 0-100-0 cycle
        
        // Power bar graphics (created but initially hidden)
        this.powerBarBackground = scene.add.rectangle(0, 0, 50, 10, 0x000000);
        this.powerBarBackground.setStrokeStyle(1, 0xFFFFFF);
        this.powerBarFill = scene.add.rectangle(0, 0, 0, 8, 0xFF0000); // Initially empty
        this.powerBarFill.setOrigin(0, 0.5);
        
        // Hide power bar initially
        this.powerBarBackground.setVisible(false);
        this.powerBarFill.setVisible(false);
        
        // Platform summoning ability properties
        this.platformWidth = 100;
        this.platformHeight = 10;
        this.platformDuration = 3000; // ms
        this.platformCooldown = 10000; // ms
        this.lastPlatformTime = 0;
        
        // Bind update to ensure correct 'this' context
        this.update = this.update.bind(this);
    }
    
    // Helper method to create an arrow directly (bypassing shoot method)
    createManualArrow(targetX, targetY, color = null) {
        if (!this.sprite || !this.scene) {
            return null;
        }
        
        try {
            // Use the Arrow class instead of creating rectangles directly
            const arrow = Arrow.createFromShot(
                this.scene,
                this.sprite.x,
                this.sprite.y,
                targetX,
                targetY,
                {
                    color: color, // Only pass color if specified, otherwise use Arrow defaults
                    baseDamage: this.baseDamage,
                    damageMultiplier: this.damageMultiplier
                }
            );
            
            return arrow;
        } catch (e) {
            return null;
        }
    }

    update(keys) {
        // Check if sprite exists
        if (!this.sprite || !this.sprite.body) {
            return;
        }
        
        // Skip controls if hero is dead
        if (!this.isAlive) {
            return;
        }
        
        // Update power bar position to follow hero
        this.updatePowerBar();
        
        // Handle left/right movement
        if (keys.left.isDown) {
            this.sprite.body.setVelocityX(-this.moveSpeed);
        } else if (keys.right.isDown) {
            this.sprite.body.setVelocityX(this.moveSpeed);
        } else {
            this.sprite.body.setVelocityX(0);
        }

        const onGround = this.sprite.body.touching.down;
        
        // Reset jump state when landing on ground
        if (onGround) {
            // If W is pressed and we're on the ground, jump
            if (keys.up.isDown) {
                this.isJumping = true;
                this.jumpStartTime = this.scene.time.now;
                this.sprite.body.setVelocityY(this.jumpPower);
            } else {
                // Reset jump state when on ground and W is not pressed
                this.isJumping = false;
            }
        } else {
            // In the air
            // Continue applying upward force while W is held and within max time
            if (keys.up.isDown && this.isJumping) {
                const jumpDuration = this.scene.time.now - this.jumpStartTime;
                
                // Apply upward force only if within max jump time
                if (jumpDuration < this.maxJumpTime) {
                    this.sprite.body.setVelocityY(this.jumpPower);
                }
            } else if (!keys.up.isDown) {
                // If W is released in mid-air, stop the current jump
                this.isJumping = false;
            }
        }
        
        // Handle fast fall with S key
        if (keys.down.isDown && !onGround) {
            this.sprite.body.setVelocityY(this.fastFallSpeed);
        }
        
        // Handle platform summoning with space bar
        if (keys.space && keys.space.isDown && !onGround) {
            this.summonPlatform();
        }
    }
    
    /**
     * Summon a platform beneath the hero
     * @returns {SummonedPlatform|null} The summoned platform or null if cooldown active
     */
    summonPlatform() {
        const now = this.scene.time.now;
        
        // Check cooldown
        if (now < this.lastPlatformTime + this.platformCooldown) {
            console.log('Platform ability on cooldown');
            return null;
        }
        
        // Update cooldown time
        this.lastPlatformTime = now;
        
        // Calculate platform position (align top with hero's bottom)
        const platformY = this.sprite.y + (this.sprite.height / 2) + (this.platformHeight / 2);
        
        // Create the platform
        const platform = new SummonedPlatform(
            this.scene,
            this.sprite.x,
            platformY,
            this.platformWidth,
            this.platformHeight,
            this.platformDuration
        );
        
        // Set up one-way collision with hero
        platform.setupOneWayCollision(this);
        
        return platform;
    }
    
    /**
     * Start charging an arrow shot
     */
    startCharging() {
        this.isCharging = true;
        this.chargeStartTime = this.scene.time.now;
        this.powerBarBackground.setVisible(true);
        this.powerBarFill.setVisible(true);
    }
    
    /**
     * Update the power bar
     */
    updatePowerBar() {
        if (!this.sprite) return;
        
        // Position power bar above hero's head
        const barX = this.sprite.x - 0; // Center the 50px bar
        const barY = this.sprite.y - 50; // Position above head
        this.powerBarBackground.setPosition(barX, barY);
        this.powerBarFill.setPosition(barX - 24, barY); // Account for origin
        
        // Update power level if charging
        if (this.isCharging) {
            // Calculate power using sine wave for oscillation
            const elapsedTime = this.scene.time.now - this.chargeStartTime;
            const cycle = (elapsedTime % this.oscillationSpeed) / this.oscillationSpeed;
            this.powerLevel = Math.abs(Math.sin(cycle * Math.PI)) * 100; // 0-100%
            
            // Update fill width based on power
            const fillWidth = (this.powerLevel / 100) * 48; // 48px is the width of the inner bar
            this.powerBarFill.width = fillWidth;
            
            // Set color based on power level
            if (this.powerLevel >= 99) {
                this.powerBarFill.setFillStyle(0x00FF00); // Green for max power
            } else {
                this.powerBarFill.setFillStyle(0xFF0000); // Red for normal power
            }
        }
    }
    
    /**
     * Stop charging and fire arrow based on power level
     * @param {number} targetX - X coordinate of target position
     * @param {number} targetY - Y coordinate of target position
     * @returns {Object|null} The created arrow or null if power too low
     */
    releaseArrow(targetX, targetY) {
        if (!this.isCharging) return null;
        
        const finalPower = this.powerLevel;
        
        // Hide the power bar
        this.powerBarBackground.setVisible(false);
        this.powerBarFill.setVisible(false);
        
        // Reset charging state
        this.isCharging = false;
        
        // Determine if we should fire based on power level
        if (finalPower < 34) {
            return null;
        }
        
        // Create the appropriate arrow based on power
        return this.shootWithPower(targetX, targetY, finalPower);
    }
    
    /**
     * Create an arrow with properties based on power level
     * @param {number} targetX - X coordinate of target position
     * @param {number} targetY - Y coordinate of target position
     * @param {number} power - Power level (0-100)
     * @returns {Object} The created arrow
     */
    shootWithPower(targetX, targetY, power) {
        // Determine if this is a max power shot
        const isMaxPower = power >= 99;
        
        try {
            // Use the Arrow class instead of creating rectangles directly
            const arrow = Arrow.createFromShot(
                this.scene,
                this.sprite.x,
                this.sprite.y,
                targetX,
                targetY,
                {
                    isMaxPower: isMaxPower,
                    baseDamage: this.baseDamage,
                    powerLevel: power,  // Pass the power level for damage scaling
                    damageMultiplier: this.damageMultiplier
                }
            );
            
            // Signal to GameScene to show "Max!" text if applicable
            if (isMaxPower && this.scene.showMaxPowerText) {
                this.scene.showMaxPowerText(this.sprite.x, this.sprite.y - 20);
            }
            
            return arrow.sprite;
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Legacy shoot method that now uses the power system
     * @param {number} targetX - X coordinate of target position
     * @param {number} targetY - Y coordinate of target position
     * @returns {Object|null} The created arrow or null if on cooldown
     */
    shoot(targetX, targetY) {
        // Safety check for sprite
        if (!this.sprite || !this.sprite.body) {
            return null;
        }
        
        const now = Date.now();
        
        // Apply cooldown
        if (now - this.lastShot < this.shootCooldown) {
            return null;
        }
        
        this.lastShot = now;
        
        // Use mid-range power for the legacy shoot method
        return this.shootWithPower(targetX, targetY, 70); // 70% power for normal shots
    }

    takeDamage(amount) {
        // Validate damage amount
        if (isNaN(amount) || amount <= 0 || !this.isAlive) return;
        
        // Apply damage
        this.health = Math.max(0, this.health - Math.round(amount));
        
        // Visual indicator of damage
        if (this.sprite && this.sprite.active) {
            // Flash red
            this.scene.tweens.add({
                targets: this.sprite,
                tint: 0xff0000,
                duration: 100,
                yoyo: true
            });
            
            // Show damage number
            if (this.scene.showDamageIndicator) {
                this.scene.showDamageIndicator(this.sprite.x, this.sprite.y, amount, true);
            }
        }
        
        // Update health bar if it exists
        if (this.scene.updateHeroHealthBar) {
            this.scene.updateHeroHealthBar();
        }
        
        // Check for death
        if (this.health <= 0) {
            this.health = 0;
            this.isAlive = false;
            
            // Stop any movement
            if (this.sprite && this.sprite.body) {
                this.sprite.body.setVelocity(0, 0);
            }
            
            // Death animation: fade out and float upward
            this.scene.tweens.add({
                targets: this.sprite,
                alpha: 0,
                y: this.sprite.y - 50, // Float upward
                duration: 1500,
                ease: 'Power1'
            });
            
            // Hide power bar if it exists
            if (this.powerBarBackground) {
                this.powerBarBackground.setVisible(false);
            }
            if (this.powerBarFill) {
                this.powerBarFill.setVisible(false);
            }
            
            console.log("Hero died, respawning in 15 seconds");
            
            // Schedule respawn after 15 seconds
            this.scene.time.delayedCall(15000, () => {
                // Reset hero
                this.health = this.maxHealth;
                this.isAlive = true;
                
                // Reset visual state
                if (this.sprite) {
                    this.sprite.setAlpha(1);
                    // Reset position to original spawn
                    this.sprite.setPosition(this.initialX, this.initialY);
                    // Reset velocity
                    if (this.sprite.body) {
                        this.sprite.body.setVelocity(0, 0);
                    }
                }
                
                // Show power bar again
                if (this.powerBarBackground) {
                    this.powerBarBackground.setVisible(true);
                }
                if (this.powerBarFill) {
                    this.powerBarFill.setVisible(false); // Keep fill hidden until needed
                }
                
                console.log("Hero respawned");
                
                // Update health bar
                if (this.scene.updateHeroHealthBar) {
                    this.scene.updateHeroHealthBar();
                }
            });
        }
    }
}
