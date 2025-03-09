/**
 * Arrow.js
 * Projectile class that handles arrow physics and collision
 */

export default class Arrow {
    constructor(scene, x, y, options = {}) {
        // Store reference to the scene
        this.scene = scene;
        
        // Default options
        const defaults = {
            color: 0x000000,            // Black by default
            width: 25,                  // Default arrow width
            height: 3,                  // Default arrow height
            speed: 900,                 // Base speed
            gravity: 300,               // Gravity strength
            lifetime: 5000,             // Maximum lifetime in ms
            angle: 0,                   // Initial angle
            speedMultiplier: 1.0,       // For power shots
            isMaxPower: false,          // Track max power shots
            baseDamage: 10,             // Base damage amount
            powerLevel: 100,            // Power level (0-100)
            damageMultiplier: 1.0       // For upgrades (future feature)
        };
        
        // Merge defaults with provided options
        this.options = { ...defaults, ...options };
        
        // Calculate damage for this arrow (centralized here)
        this.damage = this.calculateDamage();
        
        // Create arrow sprite as a rectangle (consistent with existing implementation)
        this.sprite = scene.add.rectangle(x, y, 
            this.options.width, 
            this.options.height, 
            this.options.color
        );
        
        // Store a reference to this arrow instance on the sprite for collision callbacks
        this.sprite.arrowInstance = this;
        
        // Set isMaxPower property on sprite for damage calculations
        this.sprite.isMaxPower = this.options.isMaxPower;
        
        // Set damage property on sprite
        this.sprite.damage = this.damage;
        
        // Track if the arrow has hit something to prevent multiple hits
        this.hasHit = false;
        
        // Enable physics
        scene.physics.add.existing(this.sprite);
        
        // Set arrow rotation to match angle
        this.sprite.rotation = this.options.angle;
        
        // Store creation time for lifecycle management
        this.creationTime = Date.now();
        
        // Set up physics properties
        this.setupPhysics();
        
        // Set up collisions
        this.setupCollisions();
        
        // Add to scene's arrow management if available
        if (this.scene.addArrowToScene) {
            this.scene.addArrowToScene(this.sprite);
        }
    }
    
    /**
     * Calculate damage for this arrow based on power level and properties
     * @returns {number} The calculated damage amount
     */
    calculateDamage() {
        // Base calculation
        let damage = this.options.baseDamage;
        
        // Power scaling (shots below 50% power do less damage)
        const powerLevel = this.options.powerLevel;
        const powerScaling = powerLevel < 50 ? powerLevel / 50 : 1;
        damage *= powerScaling;
        
        // Apply max power bonus (1.4x damage for max power shots)
        if (this.options.isMaxPower) {
            damage *= 1.4;
        }
        
        // Apply any damage upgrades (for future upgrade system)
        damage *= this.options.damageMultiplier;
        
        // Round to nearest integer
        return Math.round(damage);
    }
    
    setupPhysics() {
        // Allow gravity to affect the arrow (creates an arc)
        this.sprite.body.setAllowGravity(true);
        this.sprite.body.setGravityY(this.options.gravity);
        
        // Calculate velocity based on angle and speed
        const velocityX = Math.cos(this.options.angle) * this.options.speed * this.options.speedMultiplier;
        const velocityY = Math.sin(this.options.angle) * this.options.speed * this.options.speedMultiplier;
        this.sprite.body.setVelocity(velocityX, velocityY);
        
        // Make arrow rotate to match trajectory
        this.scene.time.addEvent({
            delay: 100,
            callback: this.updateRotation,
            callbackScope: this,
            loop: true
        });
    }
    
    updateRotation() {
        // Only update rotation if the arrow is still active
        if (this.sprite && this.sprite.active) {
            // Calculate angle from current velocity
            const velocity = this.sprite.body.velocity;
            if (velocity.x !== 0 || velocity.y !== 0) {
                this.sprite.rotation = Math.atan2(velocity.y, velocity.x);
            }
        } else {
            // If arrow is destroyed, cancel the timer
            this.scene.time.removeAllEvents(this);
        }
    }
    
    setupCollisions() {
        // Set up arrow lifetime
        this.scene.time.delayedCall(
            this.options.lifetime,
            this.destroy,
            [],
            this
        );
        
        // Note: Base collisions are set up in GameScene.addArrowToScene method
    }
    
    /**
     * Handle collision with a base
     * @param {Phaser.GameObjects.Rectangle} arrow - The arrow sprite
     * @param {Phaser.GameObjects.Rectangle} baseSprite - The base sprite
     */
    hitBase(arrow, baseSprite) {
        // Only process the hit once
        if (this.hasHit) return;
        
        // Mark as hit
        this.hasHit = true;
        
        // Get base instance
        const base = baseSprite.baseInstance;
        if (!base) return;
        
        // Calculate damage
        const damage = this.damage || 10;
        
        // Apply damage to base
        base.takeDamage(damage, arrow);
        
        // Make arrow stick in the base
        arrow.body.setVelocity(0, 0);
        arrow.body.setAllowGravity(false);
        
        // Rotate arrow to match its current angle
        arrow.rotation = this.options.angle;
        
        // Make the arrow stick for a moment then fade away
        this.scene.time.delayedCall(2000, () => {
            // Fade out animation
            if (arrow && arrow.active) {
                this.scene.tweens.add({
                    targets: arrow,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => this.destroy()
                });
            }
        });
    }
    
    /**
     * Handle collision with an enemy troop
     * @param {Phaser.GameObjects.Rectangle} arrow - The arrow sprite
     * @param {Phaser.GameObjects.Rectangle} enemySprite - The enemy sprite
     */
    hitEnemy(arrow, enemySprite) {
        // Only process the hit once
        if (this.hasHit) return;
        
        // Mark as hit
        this.hasHit = true;
        
        // Get troop instance from the sprite
        const troop = enemySprite.parentTroop;
        if (!troop) return;
        
        // Calculate damage
        const damage = this.damage || 10;
        
        // Apply damage to the troop based on arrow damage
        troop.takeDamage(damage);
        
        // Stop arrow movement
        arrow.body.setVelocity(0, 0);
        arrow.body.setAllowGravity(false);
        
        // Brief stick and quick fade (much faster than with bases)
        if (arrow && arrow.active) {
            this.scene.tweens.add({
                targets: arrow,
                alpha: 0,
                duration: 300, // Quicker fade than base hits
                onComplete: () => this.destroy()
            });
        }
    }
    
    destroy() {
        // Only destroy if not already destroyed
        if (this.sprite && this.sprite.active) {
            this.sprite.destroy();
        }
    }
    
    /**
     * Static factory method to create an arrow from existing Hero.shootWithPower parameters
     * Makes it easy to integrate with existing code
     */
    static createFromShot(scene, x, y, targetX, targetY, options = {}) {
        // Calculate angle to target
        const angle = Math.atan2(targetY - y, targetX - x);
        
        // Create and return a new arrow
        return new Arrow(scene, x, y, {
            angle: angle,
            color: options.color || (options.isMaxPower ? 0xFF0000 : 0x000000),
            speedMultiplier: options.speedMultiplier || (options.isMaxPower ? 1.2 : 1.0),
            isMaxPower: options.isMaxPower || false,
            baseDamage: options.baseDamage || 10,        // Base damage from hero
            powerLevel: options.powerLevel || 100,       // Power level from hero's charge
            damageMultiplier: options.damageMultiplier || 1.0  // Multiplier from hero upgrades
        });
    }
} 