/**
 * GameManager.js
 * Central game state management class implemented as a singleton
 * Handles difficulty, rounds, and will later manage economy and upgrades
 */

class GameManager {
    constructor() {
        // Ensure singleton pattern
        if (GameManager.instance) {
            return GameManager.instance;
        }
        
        GameManager.instance = this;
        
        // Game state properties
        this.difficulty = null;    // Will be set during difficulty selection
        this.currentRound = 1;     // Track the current game round
        
        // Economy system
        this.gold = 100;           // Starting gold for the player
        this.xp = 0;               // Starting XP for the player
        
        // Upgrade tracking
        this.purchasedUpgrades = {};       // In-game gold upgrades
        this.roundUpgrades = [];           // Between-round XP upgrades
        this.enemyUpgrades = [];           // Enemy upgrades applied between rounds
        this.unlockedFeatures = {};        // Features unlocked via upgrades

        // Economy configuration - these values can be adjusted via difficulty or upgrades
        this.economyConfig = {
            // Passive income settings
            passiveIncome: {
                baseAmount: 20,     // Base amount of gold per passive income tick
                interval: 5000,     // Milliseconds between passive income ticks (5 seconds)
            },
            
            // Kill reward settings
            killRewards: {
                basePercentage: 0.5, // Base percentage of unit cost rewarded (50%)
            },
            
            // XP reward settings
            xpRewards: {
                troopKill: {
                    Light: 10,
                    Ranged: 15,
                    Heavy: 20,
                },
                baseDestroy: 100,
            },
            
            // Unit costs - used both for spawning ally units and calculating enemy kill rewards
            unitCosts: {
                Light: 20,
                Ranged: 35,
                Heavy: 50,
                // Future unit types can be added here
            },
            
            // Platform ability configuration
            platformAbility: {
                cooldown: 5000,        // Base cooldown in ms (5 seconds)
                duration: 6000,        // How long platforms exist (6 seconds)
                width: 70,             // Base platform width
                hasUpgrades: false,    // Whether upgrades are unlocked
            },
            
            // Base upgrades and their costs
            baseUpgrades: {
                longbowTraining: { 
                    cost: 400,
                    description: "Unlock longbowmen units",
                    effectKey: "unlockLongbowmen"
                },
                reinforcedWalls: { 
                    cost: 300,
                    description: "Increases base health by 25%",
                    effectKey: "reinforcedWalls"
                },
                improvedArrows: { 
                    cost: 300,
                    description: "Increases arrow damage by 20%",
                    effectKey: "improvedArrows"
                },
                // Platform ability upgrades
                extendedPlatforms: {
                    cost: 300,
                    description: "Platforms last 50% longer",
                    effectKey: "extendedPlatforms",
                    category: "platformAbility"
                },
                quickSummoning: {
                    cost: 350,
                    description: "Reduces platform cooldown by 25%",
                    effectKey: "quickSummoning",
                    category: "platformAbility"
                },
                widePlatforms: {
                    cost: 400,
                    description: "Increases platform width by 40%",
                    effectKey: "widePlatforms",
                    category: "platformAbility"
                }
            },
            
            // Round-based upgrades using XP
            roundUpgrades: {
                unlockLongbowTraining: {
                    name: "Longbowman Training Ground",
                    description: "Unlock the ability to purchase longbowmen",
                    cost: 200,
                    round: 1,
                    effectKey: "unlockLongbowTraining"
                }
            },
            
            // Enemy upgrades
            enemyUpgrades: {
                enemyBaseHealthBoost: {
                    name: "Reinforced Enemy Base",
                    description: "Enemy base has 20% more health",
                    round: 1, 
                    effectKey: "enemyBaseHealthBoost",
                    effectValue: 1.2 // 20% increase
                }
            }
        };
        
        console.log('GameManager initialized');
    }
    
    /**
     * Reset the game state for a new game
     */
    resetGame() {
        this.difficulty = null;
        this.currentRound = 1;
        this.gold = 100; // Reset gold to starting value
        this.xp = 0;     // Reset XP to starting value
        this.purchasedUpgrades = {}; // Reset in-game upgrades
        this.roundUpgrades = [];     // Reset between-round upgrades
        this.enemyUpgrades = [];     // Reset enemy upgrades
        this.unlockedFeatures = {};  // Reset unlocked features
        
        // Reset future properties when implemented
        // this.stickPoints = 0;
    }
    
    /**
     * Set the game difficulty
     * @param {string} difficulty - The selected difficulty (normal, hard, insane)
     */
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        console.log(`Difficulty set to: ${difficulty}`);
    }
    
    /**
     * Get game parameters based on current difficulty
     * This will be expanded in the future to provide different values
     * based on the selected difficulty
     */
    getDifficultyParameters() {
        // Default parameters
        const params = {
            enemyStrength: 1.0,
            resourceMultiplier: 1.0
        };
        
        // Adjust parameters based on difficulty
        switch(this.difficulty) {
            case 'hard':
                params.enemyStrength = 1.5;
                params.resourceMultiplier = 0.8;
                break;
            case 'insane':
                params.enemyStrength = 2.0;
                params.resourceMultiplier = 0.6;
                break;
            case 'normal':
            default:
                // Use defaults
                break;
        }
        
        return params;
    }
    
    /**
     * Add gold to the player's account
     * @param {number} amount - Amount of gold to add
     * @param {string} source - Source of gold (for logging/tracking)
     */
    addGold(amount, source = 'unknown') {
        // Apply any modifiers based on difficulty
        const diffParams = this.getDifficultyParameters();
        const adjustedAmount = source === 'passive' 
            ? Math.floor(amount * diffParams.resourceMultiplier)
            : amount;
        
        this.gold += adjustedAmount;
        console.log(`Added ${adjustedAmount} gold from ${source}. New total: ${this.gold}`);
        return this.gold;
    }
    
    /**
     * Check if player has enough gold and deduct if true
     * @param {number} amount - Amount of gold to spend
     * @param {string} reason - What the gold is being spent on (for logging)
     * @returns {boolean} - Whether the transaction was successful
     */
    spendGold(amount, reason = 'purchase') {
        if (this.gold >= amount) {
            this.gold -= amount;
            console.log(`Spent ${amount} gold on ${reason}. Remaining: ${this.gold}`);
            return true;
        } else {
            console.log(`Not enough gold for ${reason}. Required: ${amount}, Available: ${this.gold}`);
            return false;
        }
    }
    
    /**
     * Add XP to the player
     * @param {number} amount - Amount of XP to add
     * @param {string} source - Source of XP (for logging/tracking)
     * @returns {number} - New XP total
     */
    addXP(amount, source = 'unknown') {
        this.xp += amount;
        console.log(`Added ${amount} XP from ${source}. New total: ${this.xp}`);
        return this.xp;
    }
    
    /**
     * Spend XP on a round upgrade
     * @param {number} amount - Amount of XP to spend
     * @param {string} reason - What the XP is being spent on
     * @returns {boolean} - Whether the transaction was successful
     */
    spendXP(amount, reason = 'upgrade') {
        if (this.xp >= amount) {
            this.xp -= amount;
            console.log(`Spent ${amount} XP on ${reason}. Remaining: ${this.xp}`);
            return true;
        } else {
            console.log(`Not enough XP for ${reason}. Required: ${amount}, Available: ${this.xp}`);
            return false;
        }
    }
    
    /**
     * Calculate kill reward based on unit type
     * @param {string} unitType - Type of unit killed
     * @returns {number} - Gold reward amount
     */
    calculateKillReward(unitType) {
        const unitCost = this.economyConfig.unitCosts[unitType] || 0;
        const basePercentage = this.economyConfig.killRewards.basePercentage;
        const diffParams = this.getDifficultyParameters();
        
        // Adjust reward based on difficulty (harder difficulties give slightly more reward)
        // This helps balance the reduced passive income
        const difficultyBonus = 1 + (1 - diffParams.resourceMultiplier);
        
        const reward = Math.floor(unitCost * basePercentage * difficultyBonus);
        return Math.max(reward, 1); // Ensure at least 1 gold is rewarded
    }
    
    /**
     * Get the cost of a unit based on its type
     * @param {string} unitType - Type of unit to check cost for
     * @returns {number} - Cost of the unit
     */
    getUnitCost(unitType) {
        return this.economyConfig.unitCosts[unitType] || 0;
    }
    
    /**
     * Check if an upgrade is available for purchase
     * @param {string} upgradeId - ID of the upgrade
     * @returns {boolean} - Whether the upgrade can be purchased
     */
    canPurchaseUpgrade(upgradeId) {
        const upgrade = this.economyConfig.baseUpgrades[upgradeId];
        if (!upgrade) return false;
        
        // Check if already purchased
        if (this.purchasedUpgrades[upgradeId]) return false;
        
        // Check if features required are unlocked
        if (upgradeId === 'longbowTraining' && !this.unlockedFeatures.longbowTraining) {
            return false;
        }
        
        // Check if player has enough gold
        return this.gold >= upgrade.cost;
    }
    
    /**
     * Purchase an upgrade
     * @param {string} upgradeId - ID of the upgrade to purchase
     * @returns {boolean} - Whether the purchase was successful
     */
    purchaseUpgrade(upgradeId) {
        const upgrade = this.economyConfig.baseUpgrades[upgradeId];
        
        if (!upgrade) {
            console.log(`Upgrade ${upgradeId} not found.`);
            return false;
        }
        
        if (this.purchasedUpgrades[upgradeId]) {
            console.log(`Upgrade ${upgradeId} already purchased.`);
            return false;
        }
        
        // Verify any feature requirements
        if (upgradeId === 'longbowTraining' && !this.unlockedFeatures.longbowTraining) {
            console.log('Longbow training not unlocked yet.');
            return false;
        }
        
        if (this.spendGold(upgrade.cost, `upgrade: ${upgradeId}`)) {
            this.purchasedUpgrades[upgradeId] = true;
            console.log(`Purchased upgrade: ${upgradeId} - ${upgrade.description}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Purchase a round-based upgrade with XP
     * @param {string} upgradeId - ID of the upgrade to purchase 
     * @param {number} cost - Cost in XP
     * @returns {boolean} - Whether the purchase was successful
     */
    purchaseRoundUpgrade(upgradeId, cost) {
        // Check if already purchased
        if (this.roundUpgrades.includes(upgradeId)) {
            console.log(`Round upgrade ${upgradeId} already purchased.`);
            return false;
        }
        
        // Try to spend XP
        if (this.spendXP(cost, `round upgrade: ${upgradeId}`)) {
            // Add to purchased round upgrades
            this.roundUpgrades.push(upgradeId);
            
            // Apply the upgrade effects
            this.applyRoundUpgradeEffect(upgradeId);
            
            console.log(`Purchased round upgrade: ${upgradeId}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Apply effect of a round upgrade
     * @param {string} upgradeId - ID of the upgrade to apply
     */
    applyRoundUpgradeEffect(upgradeId) {
        const upgrade = this.economyConfig.roundUpgrades[upgradeId];
        if (!upgrade) return;
        
        // Apply specific upgrade effects
        switch(upgradeId) {
            case 'unlockLongbowTraining':
                // Unlock the longbowman training feature
                this.unlockedFeatures.longbowTraining = true;
                console.log('Unlocked longbowman training feature');
                break;
                
            // Add more round upgrade effects here
            
            default:
                console.log(`No effect implementation for round upgrade: ${upgradeId}`);
                break;
        }
    }
    
    /**
     * Add an enemy upgrade that will affect the next round
     * @param {string} upgradeId - ID of the enemy upgrade to add
     */
    addEnemyUpgrade(upgradeId) {
        // Don't add duplicates
        if (this.enemyUpgrades.includes(upgradeId)) return;
        
        this.enemyUpgrades.push(upgradeId);
        console.log(`Added enemy upgrade: ${upgradeId}`);
    }
    
    /**
     * Get all enemy upgrade effects for the current state
     * @returns {Object} - Collection of enemy upgrade effects
     */
    getEnemyUpgradeEffects() {
        const effects = {};
        
        // Process all enemy upgrades
        this.enemyUpgrades.forEach(upgradeId => {
            const upgrade = this.economyConfig.enemyUpgrades[upgradeId];
            if (upgrade) {
                effects[upgrade.effectKey] = upgrade.effectValue;
            }
        });
        
        return effects;
    }
    
    /**
     * Check if a specific feature is unlocked
     * @param {string} featureId - ID of the feature to check
     * @returns {boolean} - Whether the feature is unlocked
     */
    isFeatureUnlocked(featureId) {
        return !!this.unlockedFeatures[featureId];
    }
    
    /**
     * Advance to the next round
     * @returns {number} The new current round
     */
    advanceRound() {
        this.currentRound++;
        console.log(`Advanced to round ${this.currentRound}`);
        return this.currentRound;
    }
}

// Create and export a single instance
export default new GameManager(); 