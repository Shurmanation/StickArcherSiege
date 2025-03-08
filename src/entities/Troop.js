/**
 * Troop.js
 * Basic troop entity that moves from one base to another
 */

// Nested troop configurations by category and type
const TROOP_CONFIGS = {
    Light: {
        // Default stats for the Light category
        _categoryDefaults: {
            health: 50,
            speed: 100,
            attackRange: 50,
            verticalAttackFactor: 1.7, // Can attack up to 70% of their height vertically
            attackSpeed: 1000, // ms between attacks
            attackDamage: 10,
            width: 20,
            height: 40,
            color: 0x00AA00, // Base green color
            enemyColor: 0xAA0000, // Base red color
            depth: 5 // Middle layer depth
        }
    },
    Heavy: {
        // Default stats for the Heavy category
        _categoryDefaults: {
            health: 100,
            speed: 70,
            attackRange: 40,
            verticalAttackFactor: 0.6, // Can attack up to 60% of their height vertically
            attackSpeed: 1500,
            attackDamage: 20,
            width: 30,
            height: 50,
            color: 0x008800, // Darker green
            enemyColor: 0x880000, // Darker red
            depth: 0 // Back layer depth (largest troops in back)
        }
    },
    Ranged: {
        // Default stats for the Ranged category
        _categoryDefaults: {
            health: 30,
            speed: 80,
            attackRange: 150,
            verticalAttackFactor: 2.0, // Can attack up to 2x their height vertically (for arrows)
            attackSpeed: 2000,
            attackDamage: 15,
            width: 20,
            height: 35,
            color: 0x00CC00, // Lighter green
            enemyColor: 0xCC0000, // Lighter red
            depth: 10, // Front layer depth (smallest troops in front)
            projectileType: "arrow", // Default projectile type
            projectileSpeed: 300,    // Default projectile speed
            projectileColor: 0x000000, // Default projectile color
            projectileWidth: 15,     // Default projectile width
            projectileHeight: 3      // Default projectile height
        },
        // Archer unit type within Ranged category
        Archer: {
            health: 25,
            speed: 60,
            attackRange: 200,
            attackSpeed: 2500, // Slower attack speed
            attackDamage: 25,  // Higher damage
            width: 18,
            height: 35,
            color: 0x5599FF,   // Blue-green for ally
            enemyColor: 0xFF5599, // Pink-red for enemy
            depth: 10,
            projectileType: "longbow",  // Different projectile type
            projectileSpeed: 400,       // Faster projectile
            projectileColor: 0x000000,  // Black projectile
            projectileWidth: 20,        // Longer projectile
            projectileHeight: 2         // Thinner projectile
        }
    }
};

// Damage multipliers based on attacker and target categories
const DAMAGE_MULTIPLIERS = {
    Light: {
        Light: 1.0,
        Heavy: 0.7,
        Ranged: 1.2
    },
    Heavy: {
        Light: 1.3,
        Heavy: 1.0,
        Ranged: 1.5
    },
    Ranged: {
        Light: 1.5,
        Heavy: 0.8,
        Ranged: 1.0
    }
};

// Universal engagement range for all troops
const ENGAGEMENT_RANGE = 50;

// Flash color for attack animation
const ATTACK_FLASH_COLOR = 0xFFFF00; // Yellow flash when attacking

export default class Troop {
    /**
     * Create a new troop
     * @param {Phaser.Scene} scene - The scene this troop belongs to
     * @param {number} x - Starting x position
     * @param {number} y - Starting y position
     * @param {string} category - Category of troop (defaults to "Light")
     * @param {number} targetX - X position to move towards
     * @param {boolean} isEnemy - Whether this is an enemy troop
     * @param {Object} customConfig - Optional custom configuration to override defaults
     */
    constructor(scene, x, y, category = "Light", targetX, isEnemy = false, customConfig = {}) {
        this.scene = scene;
        
        // Parse category and unitType (unit type could be part of category string, e.g., "Ranged:Archer")
        let unitType = null;
        if (category.includes(":")) {
            const parts = category.split(":");
            category = parts[0];
            unitType = parts[1];
        }
        
        // Store category
        this.category = category;
        this.unitType = unitType;
        
        // Get available category or default to Light
        const categoryConfig = TROOP_CONFIGS[category] || TROOP_CONFIGS.Light;
        
        // Get base configuration for this category
        let config = { ...categoryConfig._categoryDefaults };
        
        // If unit type is specified and exists in the category, apply unit-specific settings
        if (unitType && categoryConfig[unitType]) {
            config = { ...config, ...categoryConfig[unitType] };
        }
        
        // Finally, apply any custom config passed directly
        config = { ...config, ...customConfig };
        
        // Apply configuration
        this.health = config.health;
        this.speed = config.speed;
        this.attackRange = config.attackRange;
        this.attackSpeed = config.attackSpeed;
        this.attackDamage = config.attackDamage;
        this.troopWidth = config.width;
        this.troopHeight = config.height;
        
        // Store the config for later use with projectiles
        this.config = config;
        
        // Other properties
        this.targetX = targetX;
        this.isEnemy = isEnemy;
        this.lastAttackTime = 0;
        this.isAttacking = false;
        this.currentTarget = null; // Current attack target (troop or base)
        this.isStopped = false; // Whether the troop is stopped (for engagement)
        
        // Determine color based on category and allegiance
        const color = isEnemy ? config.enemyColor : config.color;
        
        // Create a basic sprite (rectangle)
        this.sprite = scene.add.rectangle(x, y - 20, this.troopWidth, this.troopHeight, color);
        this.baseColor = color; // Store the base color for reference
        
        // Set depth based on category for proper layering
        this.sprite.setDepth(config.depth || 5);
        
        // Enable physics
        scene.physics.add.existing(this.sprite);
        
        // Make the troop fall to the ground
        this.sprite.body.setGravityY(600);
        
        // Add basic collision with the ground
        this.sprite.body.setCollideWorldBounds(true);
        
        // Store a reference to the troop in the sprite for collision callbacks
        this.sprite.parentTroop = this;
    }
    
    /**
     * Move the troop towards its target
     * @param {number} delta - Time delta since last update
     * @param {Array} allTroops - All troops in the scene for detection
     * @param {Object} targetBase - The base this troop is targeting
     */
    move(delta, allTroops, targetBase, hero) {
        if (!this.sprite || !this.sprite.active) return;
        
        this.checkCurrentTarget();
        
        // If we're already attacking something valid, continue
        if (this.isAttacking && this.currentTarget) {
            this.attack(this.currentTarget, delta);
            return;
        }
        
        // Check for hero if we're an enemy and not engaged
        if (!this.currentTarget && this.isEnemy && hero && hero.isAlive && hero.sprite && hero.sprite.active) {
            // Check if hero is in proper attack range (considering both horizontal and vertical distances)
            if (this.isTargetInAttackRange(hero)) {
                this.currentTarget = hero;
                this.isStopped = true;
                this.isAttacking = true;
                this.attack(hero, delta);
                return;
            }
        }
        
        // Calculate direction towards target
        const direction = this.targetX > this.sprite.x ? 1 : -1;
        
        // Reset stopped state at the beginning of each update
        this.isStopped = false;
        
        // Find the nearest target (enemy troop or base)
        const nearestTarget = this.findNearestTarget(allTroops, targetBase);
        
        // If we have a target within engagement range, stop and attack
        if (nearestTarget) {
            this.isStopped = true;
            this.isAttacking = true;
            this.currentTarget = nearestTarget;
            this.attack(nearestTarget, delta);
            return;
        }
        
        // Check for same-category allies ahead (queuing behavior)
        this.isStopped = this.checkSameCategoryAlliesAhead(allTroops, direction);
        
        // If stopped due to queuing, check if we can attack from this position
        if (this.isStopped) {
            this.checkAndAttackFromQueue(allTroops, targetBase, hero);
        } else {
            // Move if not stopped
            this.moveInDirection(direction, delta);
        }
    }
    
    /**
     * Find the nearest target (enemy troop or base) within engagement range
     * @param {Array} allTroops - All troops in the scene
     * @param {Object} targetBase - The base this troop is targeting
     * @returns {Object|null} - The nearest target or null if none found
     */
    findNearestTarget(allTroops, targetBase) {
        let nearestTarget = null;
        let nearestDistance = Infinity;
        
        // Check enemy troops
        for (const troop of allTroops) {
            // Skip self or troops of same allegiance
            if (troop === this || troop.isEnemy === this.isEnemy) continue;
            
            // Calculate distance to this enemy troop
            const distance = Math.abs(troop.sprite.x - this.sprite.x);
            
            // If in engagement range and closer than previously found target
            if (distance < ENGAGEMENT_RANGE && distance < nearestDistance) {
                nearestTarget = troop;
                nearestDistance = distance;
            }
        }
        
        // Check target base
        if (targetBase) {
            const distanceToBase = Math.abs(targetBase.sprite.x - this.sprite.x);
            if (distanceToBase < ENGAGEMENT_RANGE && distanceToBase < nearestDistance) {
                nearestTarget = targetBase;
                nearestDistance = distanceToBase;
            }
        }
        
        return nearestTarget;
    }
    
    /**
     * Check if current target is still valid
     */
    checkCurrentTarget() {
        // No current target, nothing to check
        if (!this.currentTarget) {
            this.isAttacking = false;
            return;
        }
        
        // Target is destroyed or inactive
        if (!this.currentTarget.sprite || !this.currentTarget.sprite.active) {
            this.currentTarget = null;
            this.isAttacking = false;
            return;
        }
        
        // For hero targets, check using the comprehensive range function
        if (this.currentTarget.isHero) {
            if (!this.isTargetInAttackRange(this.currentTarget)) {
                this.currentTarget = null;
                this.isAttacking = false;
            }
            return;
        }
        
        // For troop targets, also use the comprehensive range function
        if (this.currentTarget.category) {
            if (!this.isTargetInAttackRange(this.currentTarget)) {
                this.currentTarget = null;
                this.isAttacking = false;
            }
            return;
        }
        
        // For bases (or other targets), use horizontal distance only
        const distance = Math.abs(this.sprite.x - this.currentTarget.sprite.x);
        if (distance > this.attackRange) {
            this.currentTarget = null;
            this.isAttacking = false;
        }
    }
    
    /**
     * Check for allies of the same category ahead in the movement path
     * @param {Array} allTroops - All troops in the scene
     * @param {number} direction - Current movement direction
     * @returns {boolean} - Whether there are allies blocking the path
     */
    checkSameCategoryAlliesAhead(allTroops, direction) {
        for (const troop of allTroops) {
            // Skip self, troops of different allegiance, or different category
            if (troop === this || 
                troop.isEnemy !== this.isEnemy || 
                troop.category !== this.category) continue;
            
            // Check if this troop is approaching another troop from behind
            const isBehind = (direction > 0 && troop.sprite.x > this.sprite.x) || 
                            (direction < 0 && troop.sprite.x < this.sprite.x);
            
            if (isBehind) {
                const distance = Math.abs(troop.sprite.x - this.sprite.x);
                const minSpacing = this.troopWidth * 1.5; // Use troop width to determine spacing
                if (distance < minSpacing) { // Stop if too close to troop ahead
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Move the troop in the specified direction
     * @param {number} direction - Direction to move (1 = right, -1 = left)
     * @param {number} delta - Time delta since last update
     */
    moveInDirection(direction, delta) {
        this.sprite.x += direction * (this.speed * delta / 1000);
        
        // Reset to base color when moving
        this.sprite.fillColor = this.baseColor;
    }
    
    /**
     * Take damage from an attack
     * @param {number} damage - Amount of damage to take
     */
    takeDamage(damage) {
        // Ensure damage is valid
        if (isNaN(damage) || damage <= 0) return;
        
        // Round damage to integer
        const damageAmount = Math.round(damage);
        
        // Apply damage
        this.health -= damageAmount;
        
        // Flash the troop to indicate damage
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0.3,
            duration: 50,
            yoyo: true
        });
        
        // Show damage indicator (only for enemy troops)
        if (this.isEnemy && this.sprite && this.sprite.active) {
            if (this.scene && this.scene.showDamageIndicator) {
                this.scene.showDamageIndicator(this.sprite.x, this.sprite.y, damageAmount);
            }
        }
        
        // Destroy if health depleted
        if (this.health <= 0) {
            // Award gold if this is an enemy troop
            if (this.isEnemy && this.scene && this.scene.awardGoldForKill) {
                this.scene.awardGoldForKill(this);
            }
            
            this.destroy();
        }
    }
    
    /**
     * Attack the target (can be a troop or base)
     * @param {Object} target - The target to attack (troop or base)
     * @param {number} delta - Time delta since last update
     */
    attack(target, delta) {
        if (!target) return;
        
        // Skip if target is destroyed
        if ((target.health !== undefined && target.health <= 0) || 
            !target.sprite || !target.sprite.active) {
            this.isAttacking = false;
            this.currentTarget = null;
            return;
        }
        
        const now = this.scene.time.now;
        
        // Attack at regular intervals
        if (now - this.lastAttackTime >= this.attackSpeed) {
            // Calculate damage with category multipliers
            let damage = this.calculateDamage(target);
            
            // Store the last attack time
            this.lastAttackTime = now;
            
            // For ranged units, create a projectile arrow
            if (this.category === "Ranged") {
                this.createRangedAttack(target, damage);
                
                // Store original color and flash to attack color to indicate attack
                const originalColor = this.sprite.fillColor;
                this.sprite.fillColor = ATTACK_FLASH_COLOR;
                
                // Reset to original color after flash
                this.scene.time.delayedCall(100, () => {
                    if (this.sprite && this.sprite.active) {
                        this.sprite.fillColor = originalColor;
                    }
                });
            } else {
                // For melee units, apply damage immediately
                if (target.takeDamage) {
                    target.takeDamage(damage);
                }
                
                // Store original color and flash to attack color to indicate attack
                const originalColor = this.sprite.fillColor;
                this.sprite.fillColor = ATTACK_FLASH_COLOR;
                
                // Reset to original color after flash
                this.scene.time.delayedCall(100, () => {
                    if (this.sprite && this.sprite.active) {
                        this.sprite.fillColor = originalColor;
                    }
                });
            }
        }
    }
    
    /**
     * Create a ranged attack projectile that travels to the target
     * @param {Object} target - The target to attack
     * @param {number} damage - The damage to apply when the projectile hits
     */
    createRangedAttack(target, damage) {
        if (!target || !target.sprite || !target.sprite.active || !this.sprite) return;
        
        // Use the stored config or fall back to default values
        const config = this.config || {};
        
        // Get projectile properties from config or use defaults
        const projectileType = config.projectileType || "arrow";
        const projectileSpeed = config.projectileSpeed || 300;
        const projectileColor = config.projectileColor || 0x000000;
        const projectileWidth = config.projectileWidth || 15;
        const projectileHeight = config.projectileHeight || 3;
        
        // Create the projectile based on type
        let arrow;
        
        if (projectileType === "longbow") {
            // Create longbow arrow (longer, thinner, colored)
            arrow = this.scene.add.rectangle(
                this.sprite.x, 
                this.sprite.y, 
                projectileWidth, 
                projectileHeight, 
                projectileColor
            );
            arrow.setDepth(15); // Above all troops but below hero
            
            // Add a trail effect (simple implementation)
            const trailParticle = this.scene.add.rectangle(
                this.sprite.x, 
                this.sprite.y, 
                projectileHeight, // Small square
                projectileHeight, 
                projectileColor
            );
            trailParticle.setDepth(14); // Slightly behind the arrow
            trailParticle.alpha = 0.5;
            
            // Make trail fade out
            this.scene.tweens.add({
                targets: trailParticle,
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    trailParticle.destroy();
                }
            });
        } else {
            // Default arrow type
            arrow = this.scene.add.rectangle(
                this.sprite.x, 
                this.sprite.y, 
                projectileWidth, 
                projectileHeight, 
                projectileColor
            );
            arrow.setDepth(15); // Above all troops but below hero
        }
        
        // Store the projectile type for hit effects
        arrow.projectileType = projectileType;
        
        // Enable physics on the arrow
        this.scene.physics.add.existing(arrow);
        
        // Calculate the angle to the target
        const targetX = target.sprite.x;
        const targetY = target.sprite.y;
        const angle = Math.atan2(targetY - this.sprite.y, targetX - this.sprite.x);
        
        // Set rotation to match angle
        arrow.rotation = angle;
        
        // Set velocity based on angle to reach target
        const velocityX = Math.cos(angle) * projectileSpeed;
        const velocityY = Math.sin(angle) * projectileSpeed;
        arrow.body.setVelocity(velocityX, velocityY);
        
        // Disable gravity on the arrow for a straight path
        arrow.body.setAllowGravity(false);
        
        // Store target reference to check for the hero specifically
        const isHeroTarget = target === this.scene.hero;
        
        // Set up collision with the target
        this.scene.physics.add.overlap(arrow, target.sprite, 
            (arrowSprite, targetSprite) => {
                // Apply damage when the arrow hits
                if (target.takeDamage) {
                    target.takeDamage(damage);
                }
                
                // Apply custom hit effect based on projectile type
                this.createHitEffect(arrowSprite, targetSprite);
                
                // Destroy the arrow after hit
                arrow.destroy();
            }, 
            null, 
            this
        );
        
        // If target is a base, check for base's hitbox which might be different
        if (!isHeroTarget && target.hitbox) {
            this.scene.physics.add.overlap(arrow, target.hitbox, 
                (arrowSprite, hitboxSprite) => {
                    // Apply damage when the arrow hits the hitbox
                    if (target.takeDamage) {
                        target.takeDamage(damage);
                    }
                    
                    // Apply custom hit effect
                    this.createHitEffect(arrowSprite, hitboxSprite);
                    
                    // Destroy the arrow after hit
                    arrow.destroy();
                }, 
                null, 
                this
            );
        }
        
        // Destroy arrow after a short time if it doesn't hit anything
        this.scene.time.delayedCall(3000, () => {
            if (arrow && arrow.active) {
                arrow.destroy();
            }
        });
    }
    
    /**
     * Create a hit effect when a projectile hits a target
     * @param {Phaser.GameObjects.Rectangle} projectile - The projectile that hit
     * @param {Phaser.GameObjects.Rectangle} target - The target that was hit
     */
    createHitEffect(projectile, target) {
        // Get the projectile type (default to "arrow")
        const projectileType = projectile.projectileType || "arrow";
        
        if (projectileType === "longbow") {
            // Create a small flash effect for longbow arrows
            const flash = this.scene.add.circle(
                target.x, 
                target.y, 
                10, 
                0x3366FF
            );
            flash.setDepth(16); // Above projectiles
            
            // Fade out and expand
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                scale: 1.5,
                duration: 200,
                onComplete: () => {
                    flash.destroy();
                }
            });
        } else {
            // Default hit effect
            const flash = this.scene.add.circle(
                target.x, 
                target.y, 
                5, 
                0xFFFFFF
            );
            flash.setDepth(16); // Above projectiles
            
            // Fade out
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 100,
                onComplete: () => {
                    flash.destroy();
                }
            });
        }
    }
    
    /**
     * Calculate damage for an attack, applying category multipliers
     * @param {Object} target - The target being attacked
     * @returns {number} - The calculated damage amount
     */
    calculateDamage(target) {
        let damage = this.attackDamage;
        
        // Apply category-based damage multipliers for troop-vs-troop combat
        if (target.category && 
            DAMAGE_MULTIPLIERS[this.category] && 
            DAMAGE_MULTIPLIERS[this.category][target.category]) {
            const multiplier = DAMAGE_MULTIPLIERS[this.category][target.category];
            damage *= multiplier;
            
            // Debug log for damage multipliers
            console.debug(`${this.category} attacking ${target.category} with ${multiplier}x multiplier (${damage} damage)`);
        }
        
        // Round damage to nearest integer
        return Math.round(damage);
    }
    
    /**
     * Determines if a target is within the troop's attack range considering both horizontal and vertical distances
     * @param {Object} target - The target to check range for (must have a sprite property)
     * @returns {boolean} - Whether the target is within proper attack range
     */
    isTargetInAttackRange(target) {
        // Safety check for valid sprites
        if (!target || !target.sprite || !target.sprite.active || !this.sprite || !this.sprite.active) {
            return false;
        }
        
        // Calculate horizontal distance between troop and target
        const horizontalDistance = Math.abs(this.sprite.x - target.sprite.x);
        
        // Check if target is within horizontal attack range
        if (horizontalDistance > this.attackRange) {
            return false;
        }
        
        // Ranged units only care about horizontal distance
        if (this.category === "Ranged") {
            return true; // If we passed the horizontal check above, we're in range
        }
        
        // For melee units (Light, Heavy), we need to be closer vertically
        
        // Get vertical attack factor from config (default to 0.5 if not specified)
        const verticalFactor = this.config.verticalAttackFactor !== undefined 
            ? this.config.verticalAttackFactor 
            : 0.5;
            
        // Calculate maximum vertical distance based on troop height and the vertical factor
        const maxVerticalDistance = this.troopHeight * verticalFactor;
        
        // Calculate actual vertical distance between troop and target
        const verticalDistance = Math.abs(this.sprite.y - target.sprite.y);
        
        // Return true if vertical distance is within range
        return verticalDistance <= maxVerticalDistance;
    }
    
    /**
     * Check if troop is within attack range of its target based on type
     * @param {number|Object} target - X position of the target or target object
     * @returns {boolean} - True if within attack range
     */
    isAtAttackRange(target) {
        // If target is an object with a sprite, use the comprehensive range check
        if (target && target.sprite) {
            return this.isTargetInAttackRange(target);
        }
        
        // If target is just an X position (for bases), use horizontal distance only
        const targetX = typeof target === 'number' ? target : target.sprite.x;
        const distance = Math.abs(this.sprite.x - targetX);
        return distance < this.attackRange;
    }
    
    /**
     * Check if we can attack targets from our current position while queued
     * @param {Array} allTroops - All troops in the scene
     * @param {Object} targetBase - The base this troop is targeting
     * @param {Object} hero - The hero object
     */
    checkAndAttackFromQueue(allTroops, targetBase, hero) {
        // Check for the hero first if we're an enemy
        if (this.isEnemy && hero && hero.isAlive && hero.sprite && hero.sprite.active) {
            // Use the new comprehensive targeting function
            if (this.isTargetInAttackRange(hero)) {
                this.currentTarget = hero;
                this.isAttacking = true;
                this.attack(hero, 0);
                return;
            }
        }
        
        // Look for other targets in range
        const targetInRange = this.findTargetInAttackRange(allTroops, targetBase);
        if (targetInRange) {
            this.currentTarget = targetInRange;
            this.isAttacking = true;
            this.attack(targetInRange, 0);
        } else if (this.isAttacking) {
            this.isAttacking = false;
            this.currentTarget = null;
        }
    }
    
    /**
     * Find any target (enemy or base) within our specific attack range
     * @param {Array} allTroops - All troops in the scene
     * @param {Object} targetBase - The base this troop is targeting
     * @returns {Object|null} - Target in range or null if none found
     */
    findTargetInAttackRange(allTroops, targetBase) {
        let bestTarget = null;
        let closestDistance = Infinity;
        
        // Check enemy troops within our attack range
        for (const troop of allTroops) {
            // Skip self or troops of same allegiance
            if (troop === this || troop.isEnemy === this.isEnemy) continue;
            
            // Use comprehensive targeting check for troops
            if (this.isTargetInAttackRange(troop)) {
                // Calculate horizontal distance for sorting by proximity
                const distance = Math.abs(troop.sprite.x - this.sprite.x);
                
                // If this is the closest valid target so far
                if (distance < closestDistance) {
                    bestTarget = troop;
                    closestDistance = distance;
                }
            }
        }
        
        // Check if base is in range (bases only use horizontal distance)
        if (targetBase) {
            const distanceToBase = Math.abs(targetBase.sprite.x - this.sprite.x);
            if (distanceToBase < this.attackRange && distanceToBase < closestDistance) {
                bestTarget = targetBase;
            }
        }
        
        return bestTarget;
    }
    
    /**
     * Destroy this troop and remove from scene
     */
    destroy() {
        if (this.sprite && this.sprite.active) {
            this.sprite.destroy();
        }
    }
} 
