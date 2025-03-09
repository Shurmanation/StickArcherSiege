/**
 * Hero.js
 * Player character class that handles movement, jumping, and shooting arrows
 */

// Import Arrow class
import Arrow from './Arrow.js';
// Import Platform class for platform summoning ability
import Platform from './Platform.js';
// Import GameManager for configuration
import gameManager from '../managers/GameManager.js';

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
        
        // Platform summoning ability - get configuration from GameManager
        this.platforms = [];
        const platformConfig = gameManager.economyConfig.platformAbility;
        this.platformCooldown = platformConfig.cooldown;
        this.platformDuration = platformConfig.duration;
        this.platformWidth = platformConfig.width;
        this.lastPlatformSummon = 0;
        this.canSummonPlatform = true;
        this.isSpaceKeyDown = false; // Track space key state
        this.cooldownTimer = null;   // Store reference to cooldown timer
        this.activePlatform = null;  // Reference to the currently active platform
        this.justDroppedThroughPlatform = false; // Track if hero just dropped through a platform
        
        // Platform cooldown indicator
        this.platformCooldownIndicator = scene.add.rectangle(0, 0, 35, 5, 0x66CCFF);
        this.platformCooldownIndicator.setStrokeStyle(1, 0x33AADD);
        this.platformCooldownIndicator.setAlpha(0.8);
        this.platformCooldownIndicator.setVisible(false);
        
        // Bind update to ensure correct 'this' context
        this.update = this.update.bind(this);
        this.summonPlatform = this.summonPlatform.bind(this);
        this.updatePlatformCooldown = this.updatePlatformCooldown.bind(this);
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
        
        // Update platform cooldown indicator
        this.updatePlatformCooldown();
        
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
        
        // Handle S key - fast fall or platform despawn
        if (keys.down.isDown) {
            // Check if hero is standing on a platform
            let standingOnPlatform = null;
            
            if (this.platforms.length > 0) {
                // Hero's position data
                const heroBottom = this.sprite.y + (this.sprite.height / 2);
                const heroX = this.sprite.x;
                
                // Check each platform
                for (const platform of this.platforms) {
                    if (!platform || !platform.sprite || platform.isFadingOut || platform.markedForDestroy) continue;
                    
                    // Platform's position data
                    const platformTop = platform.sprite.y - (platform.sprite.height / 2);
                    const platformLeft = platform.sprite.x - (platform.sprite.width / 2);
                    const platformRight = platform.sprite.x + (platform.sprite.width / 2);
                    
                    // Check if hero is standing on this platform (with a small tolerance)
                    // We check that the hero's bottom is at the platform's top (with small tolerance)
                    // AND hero is horizontally within the platform's width
                    // AND hero is either not moving vertically or moving down slightly (not jumping up)
                    const isOnPlatform = (Math.abs(heroBottom - platformTop) <= 5) && 
                                        (heroX >= platformLeft && heroX <= platformRight) &&
                                        (this.sprite.body.velocity.y >= -10); // Allow for slight upward velocity 
                    
                    if (isOnPlatform) {
                        standingOnPlatform = platform;
                        break;
                    }
                }
            }
            
            if (standingOnPlatform) {
                // If standing on a platform and pressing S, make the platform despawn
                if (standingOnPlatform.forceDespawn) {
                    // Create a quick visual effect
                    this.createDropThroughEffect(standingOnPlatform.sprite.x, standingOnPlatform.sprite.y);
                    
                    // Force despawn the platform
                    standingOnPlatform.forceDespawn();
                    
                    // Flag that we just dropped through a platform
                    // This prevents fast fall from being applied in this same frame
                    this.justDroppedThroughPlatform = true;
                    
                    // Reset the flag after a short delay to allow for normal fast falls later
                    this.scene.time.delayedCall(300, () => {
                        this.justDroppedThroughPlatform = false;
                    });
                    
                    console.log("Platform despawned by pressing S while standing on it");
                }
            } else if (!onGround && !this.justDroppedThroughPlatform) {
                // If not on a platform but in the air and not just dropped through a platform,
                // apply fast fall
                this.sprite.body.setVelocityY(this.fastFallSpeed);
            }
        }
        
        // Handle platform summoning with spacebar
        if (keys.space.isDown && !this.isSpaceKeyDown) {
            this.isSpaceKeyDown = true;
            if (this.canSummonPlatform) {
                this.summonPlatform();
            }
        } else if (!keys.space.isDown) {
            this.isSpaceKeyDown = false;
        }
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

    /**
     * Summon a platform under the hero
     */
    summonPlatform() {
        const now = this.scene.time.now;
        
        // Check if cooldown has passed
        if (now - this.lastPlatformSummon < this.platformCooldown) {
            // Show cooldown indicator
            this.showPlatformCooldownMessage();
            return;
        }
        
        // Check if there's already an active platform
        if (this.platforms.length > 0 || this.activePlatform) {
            console.log("Platform already exists, can't summon another");
            return;
        }
        
        // Calculate platform position (slightly below the hero's feet)
        const x = this.sprite.x;
        const y = this.sprite.y + (this.sprite.height / 2) + 5;
        
        try {
            // Create a new platform with current configuration
            const platform = new Platform(this.scene, x, y, {
                width: this.platformWidth,
                duration: this.platformDuration
            });
            
            // Ensure platform is solid (can be stood on)
            platform.setSolid(true);
            
            // Add the platform to our list
            this.platforms.push(platform);
            
            // Setup a simple one-way collision with the hero
            this.scene.physics.add.collider(this.sprite, platform.sprite);
            
            // Mark that the ability is on cooldown while platform exists
            this.canSummonPlatform = false;
            
            // We'll now start the cooldown when the platform disappears
            // Set the platform as the currently active one
            this.activePlatform = platform;
            
            // Setup a listener to know when the platform is destroyed
            platform.sprite.once('destroy', () => {
                // Only start cooldown if this was our active platform
                if (this.activePlatform === platform) {
                    // Start the cooldown timer
                    this.lastPlatformSummon = this.scene.time.now;
                    
                    // Set up cooldown completion callback
                    if (this.cooldownTimer) {
                        this.cooldownTimer.remove();
                    }
                    
                    this.cooldownTimer = this.scene.time.delayedCall(this.platformCooldown, () => {
                        this.canSummonPlatform = true;
                        this.showPlatformReadyMessage();
                    });
                    
                    // Clear the active platform reference
                    this.activePlatform = null;
                }
                
                // Remove from our platforms array
                const index = this.platforms.indexOf(platform);
                if (index !== -1) {
                    this.platforms.splice(index, 1);
                }
            });
            
        } catch (error) {
            console.error("Error creating platform:", error);
            // Reset cooldown in case of error
            this.canSummonPlatform = true;
        }
    }
    
    /**
     * Update platform cooldown indicator
     */
    updatePlatformCooldown() {
        if (!this.sprite) return;
        
        // Position cooldown indicator above hero's head
        const barX = this.sprite.x;
        const barY = this.sprite.y - 60; // Above the hero
        this.platformCooldownIndicator.setPosition(barX, barY);
        
        // Update cooldown progress
        if (!this.canSummonPlatform) {
            const elapsed = this.scene.time.now - this.lastPlatformSummon;
            const progress = Math.min(elapsed / this.platformCooldown, 1);
            
            // Show and update the cooldown indicator
            this.platformCooldownIndicator.setVisible(true);
            this.platformCooldownIndicator.width = 35 * progress; // 35 pixels is full width
            
            // Change color as it gets closer to ready
            this.platformCooldownIndicator.fillColor = progress > 0.5 ? 0x22FFFF : 0x66CCFF;
            
            // Auto-enable if cooldown completed but flag wasn't set
            if (progress >= 1) {
                this.canSummonPlatform = true;
                this.platformCooldownIndicator.setVisible(false);
            }
        } else {
            // Hide indicator when ability is ready
            this.platformCooldownIndicator.setVisible(false);
        }
    }
    
    /**
     * Show platform cooldown message to player
     */
    showPlatformCooldownMessage() {
        // Remaining cooldown in seconds
        const remaining = Math.ceil((this.platformCooldown - (this.scene.time.now - this.lastPlatformSummon)) / 1000);
        
        // Create a text to show the cooldown
        const text = this.scene.add.text(
            this.sprite.x,
            this.sprite.y - 70,
            `Platform: ${remaining}s`,
            { fontFamily: 'Arial', fontSize: 14, color: '#77DDFF' }
        );
        text.setOrigin(0.5);
        
        // Fade out and destroy
        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 20,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }
    
    /**
     * Show platform ready message to player
     */
    showPlatformReadyMessage() {
        // Create a text to show the ability is ready
        const text = this.scene.add.text(
            this.sprite.x,
            this.sprite.y - 70,
            'Platform Ready!',
            { fontFamily: 'Arial', fontSize: 14, color: '#22FFFF' }
        );
        text.setOrigin(0.5);
        
        // Fade out and destroy
        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            y: text.y - 20,
            duration: 1500,
            ease: 'Power2',
            onComplete: () => text.destroy()
        });
    }

    /**
     * Create a visual effect when dropping through a platform
     * @param {number} x - X position for the effect
     * @param {number} y - Y position for the effect
     */
    createDropThroughEffect(x, y) {
        // Number of particles to create
        const numParticles = 8;
        const particles = [];
        
        // Create small rectangles as particles
        for (let i = 0; i < numParticles; i++) {
            // Random position around the platform
            const particleX = x + (Math.random() * 40 - 20);
            const particleY = y + (Math.random() * 10 - 5);
            
            // Create a small rectangle
            const particle = this.scene.add.rectangle(
                particleX, 
                particleY,
                3, 
                3, 
                0x88FFAA // Same color as platform
            );
            
            // Add to our tracking array
            particles.push(particle);
            
            // Create a tween for this particle
            this.scene.tweens.add({
                targets: particle,
                y: particleY + 30 + Math.random() * 20,
                alpha: 0,
                scale: 0.5,
                duration: 500 + Math.random() * 300,
                ease: 'Power2',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }
}
