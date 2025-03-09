/**
 * Platform.js
 * Class for summoned platforms that the hero can stand on
 */

export default class Platform {
    constructor(scene, x, y, options = {}) {
        // Scene reference
        this.scene = scene;
        
        // Configure default options
        const defaults = {
            width: 70,               // Platform width (reduced from 120)
            height: 10,              // Platform height
            color: 0x88FFAA,         // Platform color
            borderColor: 0x228855,   // Border color
            duration: 6000,          // How long the platform exists (ms)
            blinkTime: 2000,         // Time to blink before fading (ms)
            fadeOutTime: 500,        // Time to fade out after blinking (ms)
            solid: true              // Whether the platform is currently solid
        };
        
        // Merge defaults with provided options
        this.options = { ...defaults, ...options };
        
        // Create platform sprite
        this.sprite = scene.add.rectangle(
            x, 
            y, 
            this.options.width, 
            this.options.height, 
            this.options.color
        );
        this.sprite.setStrokeStyle(2, this.options.borderColor);
        this.sprite.setDepth(5); // Set depth between background and characters
        
        // Enable physics
        scene.physics.add.existing(this.sprite);
        
        // Make the platform static (doesn't move when collided with)
        this.sprite.body.setImmovable(true);
        
        // Disable gravity for the platform
        this.sprite.body.setAllowGravity(false);
        
        // Set one-way collision (only collide from above)
        this.sprite.body.checkCollision.down = false;
        this.sprite.body.checkCollision.left = false;
        this.sprite.body.checkCollision.right = false;
        
        // Store a reference to this platform instance on the sprite
        this.sprite.platformInstance = this;
        
        // Lifecycle properties
        this.creationTime = scene.time.now;
        this.isBlinking = false;
        this.isFadingOut = false;
        this.markedForDestroy = false;
        this.blinkTween = null;
        
        // Add this platform to the scene's update list
        scene.events.on('update', this.update, this);
    }
    
    /**
     * Update method called every frame
     */
    update() {
        // Skip if already marked for destroy
        if (this.markedForDestroy) return;
        
        const now = this.scene.time.now;
        const age = now - this.creationTime;
        
        // Start blinking when it's time
        if (!this.isBlinking && !this.isFadingOut && 
            age >= this.options.duration - this.options.blinkTime - this.options.fadeOutTime) {
            this.startBlinking();
        }
        
        // Start fade out when it's time
        if (!this.isFadingOut && age >= this.options.duration - this.options.fadeOutTime) {
            this.startFadeOut();
        }
        
        // Destroy when lifetime is complete
        if (age >= this.options.duration) {
            this.destroy();
        }
    }
    
    /**
     * Set whether the platform is solid (can be collided with)
     * @param {boolean} isSolid - Whether the platform should be solid
     */
    setSolid(isSolid) {
        this.options.solid = isSolid;
        
        if (this.sprite && this.sprite.body) {
            this.sprite.body.checkCollision.up = isSolid;
        }
    }
    
    /**
     * Start the blinking animation to warn that the platform will fade soon
     */
    startBlinking() {
        if (this.isBlinking) return;
        
        this.isBlinking = true;
        
        // Create a blinking effect (alternating alpha between 1 and 0.3)
        this.blinkTween = this.scene.tweens.add({
            targets: this.sprite,
            alpha: { from: 1, to: 0.3 },
            duration: 200,
            yoyo: true,
            repeat: -1,
            ease: 'Linear'
        });
    }
    
    /**
     * Start the fade out animation
     */
    startFadeOut() {
        if (this.isFadingOut) return;
        
        this.isFadingOut = true;
        
        // Stop blinking if it was active
        if (this.blinkTween) {
            this.blinkTween.stop();
            this.blinkTween = null;
        }
        
        // Reset alpha to ensure smooth fade out
        this.sprite.setAlpha(1);
        
        // Now make platform non-solid during fade out
        this.setSolid(false);
        
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            duration: this.options.fadeOutTime,
            ease: 'Power1'
        });
    }
    
    /**
     * Immediately start fade out (for when player presses 's' while standing on it)
     */
    forceDespawn() {
        // Skip if already fading or destroyed
        if (this.isFadingOut || this.markedForDestroy) return;
        
        // Stop blinking if it was happening
        if (this.blinkTween) {
            this.blinkTween.stop();
            this.blinkTween = null;
        }
        
        // Start a quicker fade out
        this.isFadingOut = true;
        this.setSolid(false);
        
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            duration: 300, // Faster fade for forced despawn
            ease: 'Power1',
            onComplete: () => this.destroy()
        });
    }
    
    /**
     * Clean up and remove the platform
     */
    destroy() {
        this.markedForDestroy = true;
        
        // Remove from update event
        this.scene.events.off('update', this.update, this);
        
        // Stop any active tweens
        if (this.blinkTween) {
            this.blinkTween.stop();
            this.blinkTween = null;
        }
        
        // Disable physics before destroying
        if (this.sprite && this.sprite.body) {
            this.sprite.body.enable = false;
        }
        
        // Destroy the sprite
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
    }
} 