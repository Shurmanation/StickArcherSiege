/**
 * SummonedPlatform.js
 * Class representing a platform summoned by the hero in mid-air
 */

export default class SummonedPlatform {
    constructor(scene, x, y, width = 100, height = 10, duration = 3000) {
        this.scene = scene;
        this.duration = duration;
        this.creationTime = scene.time.now;
        
        // Create the platform sprite
        this.sprite = scene.add.rectangle(x, y, width, height, 0xAA66CC); // Light purple color
        this.sprite.setStrokeStyle(1, 0xFFFFFF);
        this.sprite.setDepth(5); // Between hero and background
        
        // Add physics
        scene.physics.add.existing(this.sprite, true); // true = static body
        
        // Track if this platform has been destroyed
        this.isDestroyed = false;
        
        // Start the despawn timer
        this.startDespawnTimer();
    }
    
    /**
     * Set up a one-way collision with the hero
     * @param {Object} hero - The hero object to collide with
     */
    setupOneWayCollision(hero) {
        // Create a collider with a process callback
        this.collider = this.scene.physics.add.collider(
            hero.sprite, 
            this.sprite,
            null, // No callback function
            this.processCollision, // Process callback
            this // Context
        );
    }
    
    /**
     * Process collision between hero and platform
     * Only allow collision when hero is falling and not pressing down key
     */
    processCollision(hero, platform) {
        // First check if platform has been destroyed
        if (this.isDestroyed) {
            return false; // Skip collision if platform is destroyed
        }
        
        // Get hero's vertical velocity
        const heroVelocity = hero.body.velocity.y;
        
        // Check if hero is falling (velocity > 0) and not pressing S key
        if (heroVelocity > 0 && !this.scene.keys.down.isDown) {
            return true; // Process the collision
        }
        
        return false; // Ignore the collision
    }
    
    /**
     * Start the timer to handle despawning
     */
    startDespawnTimer() {
        // Start blinking 1 second before despawn
        const blinkTime = this.duration - 1000;
        
        // Set up a timer event for blinking
        this.scene.time.delayedCall(blinkTime, () => {
            if (this.isDestroyed) return;
            
            // Start blinking effect
            this.blinkTimer = this.scene.time.addEvent({
                delay: 200, // Toggle visibility every 0.2 seconds
                callback: this.blink,
                callbackScope: this,
                loop: true
            });
        });
        
        // Set up final despawn
        this.scene.time.delayedCall(this.duration, () => {
            this.destroy();
        });
    }
    
    /**
     * Toggle platform visibility for blinking effect
     */
    blink() {
        if (this.isDestroyed || !this.sprite) return;
        
        // Toggle visibility
        this.sprite.visible = !this.sprite.visible;
    }
    
    /**
     * Destroy the platform and clean up resources
     */
    destroy() {
        if (this.isDestroyed) return;
        
        this.isDestroyed = true;
        
        // Clean up timers
        if (this.blinkTimer) {
            this.blinkTimer.remove();
        }
        
        // Clean up collision
        if (this.collider) {
            this.collider.destroy();
        }
        
        // Disable physics body before destroying sprite
        if (this.sprite && this.sprite.body) {
            this.sprite.body.enable = false; // Disable the physics body
            
            // Set body properties to prevent any physics calculations
            this.sprite.body.checkCollision.none = true;
            this.sprite.body.checkCollision.up = false;
            this.sprite.body.checkCollision.down = false;
            this.sprite.body.checkCollision.left = false;
            this.sprite.body.checkCollision.right = false;
        }
        
        // Destroy sprite
        if (this.sprite) {
            this.sprite.destroy();
        }
    }
    
    /**
     * Update method to be called from game loop if needed
     */
    update() {
        // Currently nothing to update in real-time
        // All behavior is timer-based
    }
} 